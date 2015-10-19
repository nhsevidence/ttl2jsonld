/*
 * TTL 2 JSON-LD
 * http://about.me/mattonfoot
 *
 * Copyright (c) 2015 Matt Smith, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  var path = require('path');

  // Project configuration.
  grunt.initConfig({

//    jshint: {
//      all: [
//        'Gruntfile.js',
//        'tasks/**/*.js',
//        '<%= nodeunit.tests %>'
//      ],
//      options: {
//        jshintrc: '.jshintrc'
//      }
//    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp']
    },

    // Configuration to be run (and then tested).
    ttl2jsonld: {
      options: {
        server:     'http://192.168.99.100:5820',
        db:         'nice',
        username:   'admin',
        password:   'admin',

        vocab: 'http://ld.nice.org.uk/ns/bnf#',
        context: {
          cnt: 'http://www.w3.org/2011/content#',
          hasClassification:            { '@container': '@set' },
          hasGeneralInformation:        { '@container': '@set' }
        }
      },

      drug: {
        options: {
          queries: [
'\
PREFIX bnf:  <http://ld.nice.org.uk/ns/bnf#>\
SELECT DISTINCT ?drug WHERE { ?drug a bnf:Drug }\
',

    // @drug <-- ?drug
    '\
CONSTRUCT { ?s ?p ?o }\
WHERE {\
  { ?s ?p ?o . FILTER( ?s IN ( @drug ) ) }\
  UNION { @drug ?x ?s }\
  UNION { @drug ?x ?y . ?y ?z ?s }\
\
  ?s ?p ?o\
}\
'
          ],

          type:  'Drug',
          dest:  'tmp/drug/'
        }
      }
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    }

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-internal');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', /*'ttl2jsonld',*/ 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test', 'build-contrib']);

};
