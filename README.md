# ttl2jsonld

> Extract JSON-LD graphs from a stardog triple store

## Getting Started

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install https://github.com/nhsevidence/ttl2jsonld.git --save
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('ttl2jsonld');
```

## TTL2JSONLD task
_Run this task with the `grunt ttl2jsonld` command._

Task targets, files and options may be specified according to the grunt [Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

### Options

#### helpers
Type: `Object`
Default: `{}`

This provides access to helper methods, such as text formatters, within the Handlebars templates. 

_Note: Please, consider the map function before creating complex template logic._

#### context
Type: `Object`  
Default: `{}`

JSON-LD graph context object.

#### vocab
Type: `String`
Default: ''

Base vocabulary for the JSON-LD graphs.

#### sync
Type: `Boolean`
Default: 'false'

Force syncronous execution becasue Stardog handles too many requests poorly.

#### server
Type: `String`
Default: ''

Stardog server URL

#### db
Type: `String`
Default: ''

Stardog DB name to execute against

#### username
Type: `String`
Default: ''

Username for the DB user to execute against

#### password
Type: `String`
Default: ''

Password for the DB user to execute against


### Usage Example

```js
ttl2jsonld: {
  models: {
    options: {
      server: 'snarl://stardog',
      db: 'myDb',
      username: 'admin',
      password: 'admin',
      vocab:  'http://schema.org/',
      context: {
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "dct": "http://purl.org/dc/terms/",
        "owl": "http://www.w3.org/2002/07/owl#",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#"
      }
    },
    reasoning: true,
    model: '...',
    type: 'owl:Thing',
    dest: './models',
  }
}
```

###### Options

Options can be specified for all `jsonld2html` tasks and for each `jsonld2html:target` just like in other Grunt tasks.
