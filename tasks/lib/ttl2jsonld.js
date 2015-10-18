/*
 * TTL 2 JSON-LD
 * http://about.me/mattonfoot
 *
 * Copyright (c) 2015 Matt Smith, contributors
 * Licensed under the MIT license.
 */

'use strict';

var IRI = require('iri').IRI;
var jsonld = require('jsonld');
var LDParser = jsonld.promises;
var path = require('path');
var Stardog = require('stardog');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

module.exports = function( grunt ) {

  var exports = {
    options: {}
  };

  exports.query = function( done ) {
    // clone the list of queries
    var queries = exports.options.queries && exports.options.queries.map ? exports.options.queries.map(function( q ) { return q; }) : exports.options.queries;
    var context = exports.createContext( exports.options.context, exports.options.lang, exports.options.vocab );
    var type    = exports.options.type;
    var frame   = exports.options.frame;

    var stardog = new Stardog.Connection();
        stardog.setEndpoint( exports.options.server );
        stardog.setCredentials( exports.options.username, exports.options.password );
    var db      = exports.options.db;

    process().then( exports.storeGraphs( exports.options.dest ) ).then(function() { done(); }).catch( grunt.fail.fatal );

    function process( datasets ) {
      var query = queries.shift();

      if ( !query ) {
        return new Promise(function( resolve, reject ) {
          if ( !datasets ) {
            return resolve( [] );
          }

          var graphs = [];
          var flattened = { bindings: [] };
          datasets.forEach(function( dataset ) {
            if ( !dataset.bindings ) {
              graphs.push( exports.frameGraph( dataset, context, frame, type ) );
            }

            flattened.bindings = flattened.bindings.concat( dataset.bindings );
          });

          if ( ~graphs.length ) {
            return RSVP.all( graphs ).then( resolve, reject );
          }

          resolve( flattened );
        });
      }

      var promises = [];
      if ( !datasets ) {
        promises.push( exports.queryStardog( stardog, db, query ) );
      } else {
        datasets.forEach(function( dataset ) {
          if ( !dataset.bindings ) return;

          dataset.bindings.map(function( recordset ) {
            promises.push( exports.queryStardog( stardog, db, exports.buildQueryFromRecordset( query, recordset ) ) );
          });
        });
      }

      return RSVP.all( promises ).then( process ).catch( grunt.log.error );
    }
  };

  exports.buildQueryFromRecordset = function( query, rs ) {
    for ( var n in rs ) {
      var value = rs[ n ].type === 'uri' ? '<'+ rs[ n ].value +'>' : rs[ n ].value;

      query = query.replace( new RegExp( '@' + n, 'gmi' ), value || '' );
    }

    return query;
  }

  exports.queryStardog = function( stardog, db, query ) {
    var qType = ~query.trim().indexOf( 'CONSTRUCT' ) ? 'queryGraph' : 'query';

    return new Promise(function( resolve, reject ) {
      stardog[ qType ]({ database: db, query: query }, onComplete );

      function onComplete( data, response ) {
        if ( response.statusCode < 200 || response.statusCode > 299 ) {
          var err = new Error( response.statusMessage + ' caused by the following SPARQL query [ ' + query + ' ]' );
          err.statusCode = response.statusCode;
          err.response = response;

          return reject( err );
        }

        resolve( data.results || data );
      }
    });
  }

  exports.frameGraph = function( graph, context, frame, type ) {
    var isGraph = !graph.bindings;

    graph = graph.bindings || graph;
    return LDParser.compact( graph, context, { compactArrays: false })
      .then(function( graph ) {

        if ( !frame ) frame = { '@type': type || exports.getTypesFromGraph( graph ) || 'owl:Thing' };
        frame[ '@context' ] = frame[ '@context' ] || context;

        if ( !isGraph ) return graph;

        return LDParser.frame( graph, frame );
      });
  };

  // returns an extended default jsonld context with language and optional @vocab set
  exports.createContext = function( contexts, lang, vocab ) {
    var ctx = {
      "@language": lang,
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
    };

    if ( vocab ) ctx['@vocab'] = vocab;

    for ( var c in contexts ) ctx[ c ] = contexts[ c ];

    return ctx;
  };

  // inspects a jsonld graph for types
  exports.getTypesFromGraph = function( graph ) {
    var types = [];

    if ( graph['@graph'] ) {
      graph['@graph'].forEach(function( x ) {
        var type = x['@type'];
        if ( typeof type === 'string' ) return types.push( type );

        types = types.concat( type );
      });
    }

    if ( types.length < 2 ) {
      return types[0] || 'owl:Thing';
    }

    return types;
  };

  // returns a function that resolves a promise after writing an array of jsonld resources to disc
  exports.storeGraphs = function( dest ) {
    var store = exports.storeGraph( dest );

    return function( resources ) {
      return new Promise(function( resolve, reject ) {
        resolve( resources.map( store ) );
      });
    };
  };

  // returns a function that writes jsonld to disc after processing the path as a template with the jsonld graph passed in
  exports.storeGraph = function( dest ) {
    if ( !dest ) {
      throw new Error( 'no destination folder supplied' );
    }

    return function( jsonld ) {
      var graph = ( jsonld[ '@graph' ] && jsonld[ '@graph' ][ 0 ] ) || jsonld;

      var iri = new IRI( jsonld[ '@graph' ].length == 1 ? graph[ '@id' ] : 'index' );
      var id = iri.fragment();
          id = path.basename( id ? id.replace( '#', '' ) : iri.toIRIString() );

      var ext = path.extname( id );
      var file = ( ext ? id.replace( ext, '' ) : id ) + '.jsonld';
      var filename = path.join( dest, file ).toLowerCase();

      grunt.file.mkdir( path.dirname( filename ) );
      grunt.file.write( filename, JSON.stringify( jsonld, null, '\t' ) );

      return jsonld;
    };
  };

  return exports;
};
