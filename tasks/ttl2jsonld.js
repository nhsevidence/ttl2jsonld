var path = require('path');
var mkdirp = require('mkdirp');
var Stardog = require('stardog');
var sparql = require('sparqljs');
var SparqlGenerator = sparql.Generator;

var defaults = {
  type: 'http://ld.nice.org.uk/ns/bnf/drug',

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

    var query = listOfTypeQuery( options );
    queryStore( stardog, options.db, query )
      .then(function( result ) {
        console.log( result );

        grunt.log.writeln( "OK");

        done();
      })
      .catch( grunt.fail.fatal );
  });




  // helpers

  function queryStore( stardog, db, query ) {
    grunt.verbose.ok( query );

    return new Promise(function( resolve, reject ) {
      stardog.query({
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
    var generator = new SparqlGenerator();
    var query = {
      type: "query",
      prefixes: {},
      queryType: "SELECT",
      variables: [ "?s" ],
      where: [
        {
          "type": "bgp",
          "triples": [
            {
              "subject": "?s",
              "predicate": "a",
              "object": options.type
            }
          ]
        }
      ]
    };

    var prefixes = query.prefixes = query.prefixes || {};
    for ( var p in options.prefixes || {} ) {
      if ( !prefixes[ p ] ) prefixes[ p ] = pfx[ p ];
    }

    return generator.stringify( query );
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
