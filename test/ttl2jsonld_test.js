'use strict';

var grunt = require('grunt');
var ttl2jsonld = require('../tasks/lib/ttl2jsonld')(grunt);

exports.ttl2jsonld = {

  empty_query: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( '', { foo: { value: 'bar' } } );
    var expected = '';

    test.equal(actual, expected, 'should describe what happens when the query is empty.');

    test.done();
  },

  no_recordset: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( ' @foo ' );
    var expected = ' @foo ';

    test.equal(actual, expected, 'should describe what happens when the recordset is not passed.');

    test.done();
  },

  empty_recordset: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( ' @foo ', {} );
    var expected = ' @foo ';

    test.equal(actual, expected, 'should describe what happens when the recordset is empty.');

    test.done();
  },

  corrupt_recordset: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( ' @foo ', { foo: 'bar' } );
    var expected = '  ';

    test.equal(actual, expected, 'should describe what happens when the recordset is corrupt.');

    test.done();
  },

  simple_recordset: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( ' @foo ', { foo: { value: 'bar' } } );
    var expected = ' bar ';

    test.equal(actual, expected, 'should describe what happens when there is a recordset present.');

    test.done();
  },

  multiple_values: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( ' @foo @bar @baz ', { foo: { value: 'bar' }, bar: { value: 'foo' } } );
    var expected = ' bar foo @baz ';

    test.equal(actual, expected, 'should describe what happens when there are multiple values in a recordset.');

    test.done();
  },

  unassigned_variables: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( ' @foo @bar ', { foo: { value: 'bar' } } );
    var expected = ' bar @bar ';

    test.equal(actual, expected, 'should describe what happens when there are unassigned variables in the query.');

    test.done();
  },

  uri_type: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.buildQueryFromRecordset( ' @foo @bar ', { foo: { type: 'uri', value: 'bar' } } );
    var expected = ' <bar> @bar ';

    test.equal(actual, expected, 'should describe what happens when there are uri values in the recordset.');

    test.done();
  },

  empty_types: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.getTypeFromGraph( {} );
    var expected = 'owl:Thing';

    test.equal(actual, expected, 'should describe what happens by default.');

    test.done();
  },

  empty_graph: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.getTypeFromGraph( { '@graph': [] } );
    var expected = 'owl:Thing';

    test.equal(actual, expected, 'should describe what happens by default.');

    test.done();
  },

  single_typed_graph: function(test) {
    test.expect(1);
    var actual = ttl2jsonld.getTypeFromGraph( { '@graph': [ { '@type': 'foo' } ] } );
    var expected = 'foo';

    test.equal(actual, expected, 'should return the set single type.');

    test.done();
  },

  multiple_typed_graphs: function(test) {
    test.expect(3);
    var actual = ttl2jsonld.getTypeFromGraph( { '@graph': [ { '@type': 'foo' }, { '@type': 'bar' } ] } );
    var expected = [ 'foo', 'bar' ];

    test.equal(actual[0], expected[0], 'should describe first result.');
    test.equal(actual[1], expected[1], 'should describe second result.');
    test.equal(actual.length, expected.length, 'should have the same length.');

    test.done();
  },

  multi_typed_graph: function(test) {
    test.expect(3);
    var actual = ttl2jsonld.getTypeFromGraph( { '@graph': [ { '@type': [ 'foo', 'bar' ] } ] } );
    var expected = [ 'foo', 'bar' ];

    test.equal(actual[0], expected[0], 'should describe first result.');
    test.equal(actual[1], expected[1], 'should describe second result.');
    test.equal(actual.length, expected.length, 'should have the same length.');

    test.done();
  },

  single_and_multi_typed_graphs: function(test) {
    test.expect(4);
    var actual = ttl2jsonld.getTypeFromGraph( { '@graph': [ { '@type': [ 'foo', 'bar' ] }, { '@type': [ 'baz' ] } ] } );
    var expected = [ 'foo', 'bar', 'baz' ];

    test.equal(actual[0], expected[0], 'should describe first result.');
    test.equal(actual[1], expected[1], 'should describe second result.');
    test.equal(actual[2], expected[2], 'should describe third result.');
    test.equal(actual.length, expected.length, 'should have the same length.');

    test.done();
  },

  multiple_multi_typed_graphs: function(test) {
    test.expect(5);
    var actual = ttl2jsonld.getTypeFromGraph( { '@graph': [ { '@type': [ 'foo', 'bar' ] }, { '@type': [ 'baz', 'boo' ] } ] } );
    var expected = [ 'foo', 'bar', 'baz', 'boo' ];

    test.equal(actual[0], expected[0], 'should describe first result.');
    test.equal(actual[1], expected[1], 'should describe second result.');
    test.equal(actual[2], expected[2], 'should describe third result.');
    test.equal(actual[3], expected[3], 'should describe fourth result.');
    test.equal(actual.length, expected.length, 'should have the same length.');

    test.done();
  }

};
