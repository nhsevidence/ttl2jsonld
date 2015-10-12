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

  type:       'http://ld.nice.org.uk/ns/bnf#Drug',
  labeledBy:  'http://www.w3.org/2000/01/rdf-schema#label',
  dest:       'artifacts/www/'

};

module.exports = function( grunt ) {

  grunt.registerMultiTask( 'ttl2jsonld', 'Extracts JSON-LD from a triple store', function() {
    var done = this.async();

    var options = this.options( defaults );

    grunt.log.writeln( "Retrieving a list of resources...");
    listOfTypeQuery( grunt, options.type, options )
      .then( frameGraph( grunt, options ) )
      .then( storeGraph( grunt, options ) )
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
      queryType: "CONSTRUCT",
      template: [
        { 'subject': '?entity', 'predicate': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'object': entityType },
        { 'subject': '?entity', 'predicate': options.labeledBy, 'object': '?name' }
      ],
      where: [
        {
          "type": "bgp",
          "triples": [
            { 'subject': '?entity', 'predicate': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'object': entityType },
            { 'subject': '?entity', 'predicate': options.labeledBy, 'object': '?name' }
          ]
        }
      ],
      order: [
        {
          "expression": "?name"
        }
      ]
    };

    return queryStore( grunt, 'queryGraph', query, options );
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
          if ( response['@graph'].length <= 0 ) {
            resolve( graphs );
            return;
          }

          var graph = response['@graph'].pop();

          console.dir( graph );

          subgraphQuery( grunt, graph['@id'], options )
            .then(function( r ) {
              grunt.log.debug( r );
              grunt.log.debug( "" );

              graphs.push( r );

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

      var promises = graphs.map(function( g ) {
        return LDParser.compact( g, context )
          .then(function( c ) {
            grunt.log.debug( c );
            grunt.log.debug( "" );

            return LDParser.frame( c, frame );
          })
          .then(function( f ) {
            grunt.log.debug( f );
            grunt.log.debug( "" );

            return f;
          });
      });

      return RSVP.all( promises );
    };
  }

  function frameGraph( g, o ) {
    var grunt = g;
    var options = o;

    return function( graph ) {

      var frame = { '@type': options.type };

      var context = frame['@context'] = {};
      for ( var p in options.prefixes || {} ) {
        if ( !context[ p ] ) context[ p ] = options.prefixes[ p ];
      }

      return LDParser.compact( graph, context )
        .then(function( c ) {
          grunt.log.debug( c );
          grunt.log.debug( "" );

          return LDParser.frame( c, frame );
        })
        .then(function( f ) {
          grunt.log.debug( f );
          grunt.log.debug( "" );

          return f;
        });
    };
  }


  function storeGraphs( g, o ) {
    var grunt = g;
    var options = o;
    var store = storeGraph( g, o );

    return function( resources ) {
      return new Promise(function( resolve, reject ) {
        grunt.log.writeln( "Storing JSON-LD...");
        process();

        function process() {
          if ( resources.length <= 0 ) {
            resolve( resources );
            return;
          }

          store( resources.pop() );

          process();
        }
      });
    };
  }


  function storeGraph( g, o ) {
    var grunt = g;
    var options = o;

    return function( resource ) {
      console.dir( resource );

      var graph = resource[ '@graph' ][ 0 ];

      var iri = new IRI( resource[ '@graph' ].length == 1 ? graph[ '@id' ] : 'index' );
      var id = iri.fragment();
          id = path.basename( id ? id.replace( '#', '' ) : iri.toIRIString() );

      var ext = path.extname( id );
      var file = ext ? id.replace( ext, '.jsonld' ) : id + '.jsonld';
      var filename = path.join( options.dest, file ).toLowerCase();

      mkdirp.sync( path.dirname( filename ) );
      grunt.file.write( filename, JSON.stringify( resource, null, '\t' ) );

      return resource;
    };
  }

};
