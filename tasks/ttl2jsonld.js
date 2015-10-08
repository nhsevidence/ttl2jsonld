var path = require('path');
var mkdirp = require('mkdirp');
var Stardog = require('stardog');
var sparql = require('sparqljs');
var SparqlGenerator = sparql.Generator;
var IRI = require('iri').IRI;
var jsonld = require('jsonld');
var LDParser = jsonld.promises;
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

var defaults = {
  // stardog
  server:   "http://stardog:5820", // Stardog server http endpoint
  db:       "nice",                       // Stardog database
  username: "admin",
  password: "admin",

  prefixes: {},

  type: 'http://ld.nice.org.uk/ns/bnf#Drug',
  dest: 'artifacts/www/'

};

module.exports = function( grunt ) {

  grunt.registerMultiTask( 'ttl2jsonld', 'Extracts JSON-LD from a triple store', function() {
    var done = this.async();

    var options = this.options( defaults );

    grunt.log.writeln( "Retrieving a list of resources...");
    listOfTypeQuery( grunt, options.type, options )
      .then( retrieveGraphs( grunt, options ) )
      .then( frameGraphs( grunt, options ) )
      .then( storeGraphs( grunt, options ) )
      .then(function( resources ) {
        grunt.log.ok( "OK" );

        done();
      })
      .catch( grunt.fail.fatal );
  });




  // helpers


  function listOfTypeQuery( grunt, type, options ) {
    var entityType = new IRI( type ).toIRIString();

    var query = {
      type: "query",
      queryType: "SELECT",
      variables: [ "?s" ],
      where: [
        {
          "type": "bgp",
          "triples": [
            { "subject": '?s', "predicate": 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', "object": entityType }
          ]
        }
      ]
    };

    return queryStore( grunt, 'query', query, options );
  }

  function subgraphQuery( grunt, id, options ) {
    var entityId = new IRI( id ).toIRIString();

    var query = {
      type: "query",
      queryType: "CONSTRUCT",
      template: [
        { 'subject': entityId, 'predicate': "?p", 'object': '?o' }
      ],
      where: [
        {
          "type": "bgp",
          "triples": [
            { 'subject': entityId, 'predicate': "?p", 'object': '?o' }
          ]
        }
      ]
    };

    return queryStore( grunt, 'queryGraph', query, options );
  }

  function queryStore( g, qType, query, o ) {
    var grunt = g;

    var options = o;
        if ( options.port ) options.port = options.port * 1;
        if ( options.port === 443 ) options.secure = true;

    var stardog = new Stardog.Connection();
        stardog.setEndpoint( options.server );
        stardog.setCredentials( options.username, options.password );

    var sparql = prefixQuery( query, options );

    grunt.verbose.ok( sparql );

    return new Promise(function( resolve, reject ) {
      stardog[ qType ]({
          database: options.db,
          query: sparql
        },
        onComplete );

      function onComplete( data, response ) {
        if ( response.statusCode < 200 || response.statusCode > 299 ) {
          var err = new Error( response.statusMessage + ' [ ' + sparql + ' ]' );
          err.statusCode = response.statusCode;
          err.response = response;

          grunt.fail.fatal( err );

          return reject( err );
        }

        resolve( data.results || data );
      }
    });
  }

  function prefixQuery( query, options ) {
    var prefixes = query.prefixes = {};
    for ( var p in options.prefixes || {} ) {
      if ( !prefixes[ p ] ) prefixes[ p ] = options.prefixes[ p ];
    }

    return new SparqlGenerator().stringify( query );
  }

  function retrieveGraphs( g, o ) {
    var grunt = g;
    var options = o;

    return function( response ) {
      var graphs = [];

      return new Promise(function( resolve, reject ) {
        grunt.log.writeln( "Retrieving resource graphs...");
        process();

        function process() {
          if ( response.bindings.length <= 0 ) {
            resolve( graphs );
            return;
          }

          var triple = response.bindings.pop();

          subgraphQuery( grunt, triple.s.value, options )
            .then(function( graph ) {
              graphs.push( graph[0] );

              process();
            });
        }
      });
    }
  }

  function frameGraphs( g, o ) {
    var grunt = g;
    var options = o;

    return function( graphs ) {
      grunt.log.writeln( "Framing Graphs...");

      var frame = { '@type': options.type };

      var context = frame['@context'] = {};
      for ( var p in options.prefixes || {} ) {
        if ( !context[ p ] ) context[ p ] = options.prefixes[ p ];
      }

      return RSVP.all( graphs.map(function( graph ) { return LDParser.frame( graph, frame ); }) );
    };
  }

  function storeGraphs( g, o ) {
    var grunt = g;
    var options = o;

    return function( resources ) {
      return new Promise(function( resolve, reject ) {
        grunt.log.writeln( "Storing JSON-LD...");
        process();

        function process() {
          if ( resources.length <= 0 ) {
            resolve( resources );
            return;
          }

          var resource = resources.pop();
          var graph = resource[ '@graph' ][ 0 ];

          var iri = new IRI( graph[ '@id' ] );

          var id = iri.fragment();
              id = path.basename( id ? id.replace( '#', '' ) : iri.toIRIString() );
          var ext = path.extname( id );
          var file = ext ? id.replace( ext, '.jsonld' ) : id + '.jsonld';

          console.log( '>>>', id, '-->', file );

          var filename = path.join( options.dest, file );

          mkdirp.sync( path.dirname( filename ) );
          grunt.file.write( filename, JSON.stringify( graph, null, '\t' ) );

          process();
        }
      });
    };
  }

};
