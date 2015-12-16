/*
 * TTL 2 JSON-LD
 * http://about.me/mattonfoot
 *
 * Copyright (c) 2015 Matt Smith, contributors
 * Licensed under the MIT license.
 */

(function( module ){
'use strict';

var IRI = require('iri').IRI;
var jsonld = require('jsonld');
var LDParser = jsonld.promises;
var path = require('path');
var Stardog = require('./stardog-sync');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;
var util = require('util');
var N3 = require('n3');

// Utils for dealing with IRIs
var N3Util = N3.Util;

module.exports = function( grunt ) {

  var exports = {
    options: {}
  };

  exports.query = function( done ) {
    var context = exports.createContext( exports.options.context, exports.options.lang, exports.options.vocab );
    var type    = exports.options.type;
    if ( type ) type = N3Util.expandPrefixedName( type, context );
    var frame   = exports.options.frame;

    var stardog = new Stardog.Connection();
        stardog.setEndpoint( exports.options.server );
        stardog.setCredentials( exports.options.username, exports.options.password );
        stardog.setReasoning( exports.options.reasoning || false );
    var db      = exports.options.db;

    var index = exports.options.index || " SELECT ?entity WHERE { ?entity a <"+ type +"> } ";
    var model = exports.options.model;
    if ( model ) {
      return processIndexQuery( index )
                    .then( processModelQuery( model ) )
                    .then(function() { done(); })
                    .catch( grunt.fail.fatal );
    }

    return processIndexQuery( index )
                  .then( prepareForSaving )
                  .then( exports.storeGraph( exports.options.dest, exports.options.filename ) )
                  .then(function() { done(); })
                  .catch( grunt.fail.fatal );

    function processIndexQuery( query ) {
      return exports.queryStardog( stardog, db, query );
    }

    function processModelQuery( query ) {
      return function( dataset ) {
        if ( !dataset.bindings ) return;

        return RSVP.all( dataset.bindings.map( runModelQuery ) );

        function runModelQuery( recordset ) {
          return new Promise(function( resolve, reject ) {
            var modelQuery = exports.buildQueryFromRecordset( query, recordset );

            exports.queryStardog( stardog, db, modelQuery )
                   .then( prepareForSaving )
                   .then( exports.storeGraph( exports.options.dest, exports.options.filename ) )
                   .then( resolve, reject );
          });
        }
      };
    }

    function prepareForSaving( dataset ) {
      if ( !dataset ) return [];

      if ( dataset.bindings ) return dataset.bindings;

      return exports.generateFrame( frame, context, [ dataset ], type )
                    .then( withFrame );

      function withFrame( frame ) {
        return exports.frameGraph( dataset, context, frame );
      }
    }
  };

  exports.buildQueryFromRecordset = function( query, rs ) {
    for ( var n in rs ) {
      var value = rs[ n ].type === 'uri' ? '<'+ rs[ n ].value +'>' : rs[ n ].value;

      query = query.replace( new RegExp( '@' + n, 'gmi' ), value || '' );
    }

    return query;
  };

  exports.queryStardog = function( stardog, db, query ) {
    var qType = ~query.trim().indexOf( 'CONSTRUCT' ) ? 'queryGraph' : 'query';

    return new Promise(function( resolve, reject ) {
      stardog[ qType ]({ database: db, query: query }, onComplete );

      function onComplete( data, response, e ) {
        if ( !response ) {
          throw data;
        }

        if ( response.statusCode < 200 || response.statusCode > 299 ) {
          var err = new Error( response.statusMessage + ' caused by the following SPARQL query [ ' + query + ' ]' );
          err.statusCode = response.statusCode;
          err.response = response;

          return reject( err );
        }

        resolve( data.results || data );
      }
    });
  };

  exports.frameGraph = function( graph, context, frame ) {
    var isGraph = !graph.bindings;

    graph = graph.bindings || graph;
    if ( !isGraph ) return graph;

    graph = { '@graph': graph };

    return LDParser.frame( graph, frame )
          .catch(function( e ){
            grunt.log.error( e );
            grunt.fail.fatal( JSON.stringify( frame, null, ' ' ) );
          });
  };

  // returns an extended default jsonld context with language and optional @vocab set
  exports.createContext = function( contexts, lang, vocab ) {
    var ctx = {
       rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns',
       dct: 'http://purl.org/dc/terms/',
       owl: 'http://www.w3.org/2002/07/owl#',
       xsd: 'http://www.w3.org/2001/XMLSchema#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
    };

    if ( lang ) ctx['@language'] = lang;
    if ( vocab ) ctx['@vocab'] = vocab;

    for ( var c in contexts ) ctx[ c ] = contexts[ c ];

    return ctx;
  };

  // inspects a jsonld graph for types
  exports.getTypeFromGraph = function( graph ) {
    var types = [];

    if ( graph['@graph'] ) {
      graph['@graph'].forEach(function( x ) {
        var type = x['@type'];

        if ( !type ) return;
        if ( typeof type === 'string' ) type = [ type ];

        type.forEach(function( t ) { if ( !~types.indexOf( t ) ) types.push( t ); });
      });
    }

    if ( types.length < 2 ) {
      return types[0] || 'owl:Thing';
    }

    return types;
  };

  // returns a function that resolves a promise after writing an array of jsonld resources to disc
  exports.storeGraphs = function( dest, filename ) {
    var store = exports.storeGraph( dest, filename );

    return function( resources ) {
      return new Promise(function( resolve, reject ) {
        if ( resources.bindings ) {
          return resolve( store( resources.bindings ) );
        }

        return resolve( resources.map( store ) );
      });
    };
  };

  // returns a function that writes jsonld to disc after processing the path as a template with the jsonld graph passed in
  exports.storeGraph = function( dest, f ) {
    if ( !dest ) {
      throw new Error( 'no destination folder supplied' );
    }

    return function( jsonld ) {
      var filename = f;
      if ( !filename ) {
        var graph = ( jsonld[ '@graph' ] && jsonld[ '@graph' ][ 0 ] ) || jsonld;

        var iri = new IRI( jsonld[ '@graph' ].length == 1 ? graph[ '@id' ] : 'index' );
        var id = iri.fragment();
            id = path.basename( id ? id.replace( '#', '' ) : iri.toIRIString() );

        var ext = path.extname( id );
        filename = ( ext ? id.replace( ext, '' ) : id );
      }

      var filepath = path.join( dest, filename + '.json' ).toLowerCase();

      grunt.file.mkdir( path.dirname( filepath ) );
      grunt.file.write( filepath, JSON.stringify( jsonld, null, '\t' ) );

      return jsonld;
    };
  };

  exports.generateFrame = function( frame, context, datasets, type ) {
    return new Promise(function( resolve, reject ) {
      if ( !frame ) frame = {};

      if ( !context && datasets.length > 1 ) {
        context = {};
        datasets.forEach(function( dataset ) {
          dataset.forEach(function( x ) {
            exports.detectCollections( x, context );
          });
        });
      }

      return LDParser.compact( frame, context )
        .then(function( frame ) {
          frame[ '@embed' ] = '@always';
          if ( !frame['@type'] && !frame['@id'] )frame[ '@type' ] = ( type || exports.getTypeFromGraph( datasets.length && datasets[0] ) || 'owl:Thing' );

          return resolve( frame );
        });
    });
  };

  exports.detectCollections = function( entity, frame ) {
    for ( var prop in entity ) {
      if ( prop.indexOf('@') === 0 ) continue;

      if ( entity.hasOwnProperty( prop ) && util.isArray( entity[ prop ] ) && entity[ prop ].length > 1 ) {
        frame[ prop ] = { '@container': '@set' };
      }
    }
  };

  return exports;
};
})( module );
