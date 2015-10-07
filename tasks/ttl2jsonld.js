var path = require('path');
var mkdirp = require('mkdirp');
var Stardog = require('stardog');
var sparql = require('sparqljs');
var SparqlGenerator = sparql.Generator;
var IRI = require('iri').IRI;

var defaults = {
  type: 'http://ld.nice.org.uk/ns/bnf/drug',

  dest: 'artifacts/jsonld/',

  // stardog
  server:   "http://192.168.99.100:5820", // Stardog server http endpoint
  db:       "nice",                       // Stardog database
  username: "admin",
  password: "admin",

  prefixes: {}
};

module.exports = function( grunt ) {

  grunt.registerMultiTask( 'ttl2jsonld', 'Extracts JSON-LD from a triple store', function() {
    var done = this.async();

    var options = this.options( defaults );
        if ( options.port ) options.port = options.port * 1;
        if ( options.port === 443 ) options.secure = true;

    var stardog = new Stardog.Connection();
        stardog.setEndpoint( options.server );
        stardog.setCredentials( options.username, options.password );

    grunt.log.write( "Retrieving a list of resources...");
    queryStore( stardog, options.db, listOfTypeQuery( options ) )
      .then( processResources )
      .then( storeResources )
      .then(function( resources ) {
        done();
      })
      .catch( grunt.fail.fatal );





    function processResources( results ) {
      var resources = [];
      return new Promise(function( resolve, reject ) {
        grunt.log.write( "Retrieving resource graphs...");
        process();

        function process() {
          if ( results.bindings.length <= 0 ) {
            resolve( resources );
            return;
          }

          var result = results.bindings.pop();

          queryStore( stardog, options.db, 'queryGraph', subgraphQuery( result.s.value, options ) )
            .then(function( resource ) {
              resources.push( resource );

              process();
            });
        }
      });
    }

    function storeResources( resources ) {
      return new Promise(function( resolve, reject ) {
        process();

        function process() {
          if ( resources.length <= 0 ) {
            resolve( resources );
            return;
          }

          var graph = resources.pop()[0];

          var id = graph[ '@id' ];
          var filename = path.join( options.dest, path.basename( id ).replace( path.extname( id ), '.jsonld' ) );

          mkdirp.sync( path.dirname( filename ) );
          grunt.file.write( filename, JSON.stringify( graph, null, '\t' ) );

          process();
        }
      });
    }
  });




  // helpers

  function queryStore( stardog, db, qType, query ) {
    if (!query) {
      query = qType;
      qType = 'query';
    }

    grunt.verbose.ok( query );

    return new Promise(function( resolve, reject ) {
      stardog[ qType ]({
          database: db,
          query: query
        },
        onComplete );

      function onComplete( data, response ) {
        if ( response.statusCode < 200 || response.statusCode > 299 ) {
          var err = new Error( response.statusMessage + ' [ ' + query + ' ]' );
          err.statusCode = response.statusCode;
          err.response = response;

          grunt.fail.fatal( err );

          return reject( err );
        }

        resolve( data.results || data );
      }
    });
  }

  function listOfTypeQuery( options ) {
    var query = {
      type: "query",
      queryType: "SELECT",
      variables: [ "?s" ],
      where: [
        {
          "type": "bgp",
          "triples": [
            {
              "subject": '?s',
              "predicate": 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              "object": options.type
            }
          ]
        }
      ]
    };

    return prefixQuery( query, options );
  }

  function subgraphQuery( id, options ) {
    var entity = new IRI( id ).toIRIString();

    var query = {
      type: "query",
      queryType: "CONSTRUCT",
      template: {
        'subject': entity,
        'predicate': "?p",
        'object': '?o'
      },
      where: [
        {
          "type": "bgp",
          "triples": [
            {
              'subject': entity,
              'predicate': "?p",
              'object': '?o'
            }
          ]
        }
      ]
    };

    return prefixQuery( query, options );
  }

  function prefixQuery( query, options ) {
    var prefixes = query.prefixes || {};
    for ( var p in options.prefixes || {} ) {
      if ( !prefixes[ p ] ) prefixes[ p ] = pfx[ p ];
    }

    return new SparqlGenerator().stringify( query );
  }

  function loadFrames( cwd ) {
  	var files = grunt.file.expand( { cwd: cwd }, '*.json' );

    return process( files );

    function process( files, frames ) {
      frames = frames || {};

      if ( files.length <= 0 ) {
        return frames;
      }

      var filename = files.pop();
      var file = path.join( cwd, filename );
      var type = filename.replace( '.json', '' );

      grunt.verbose.writeln( "Loading frame " + file + "...");
      var content = grunt.file.read(file, { encoding: 'utf8' });

      frames[ type ] = JSON.parse( content );

      return process( files, frames );
    }
  }

};
