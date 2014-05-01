// uses the nodejs uglify-js library to combine and minify javascript files; parse the script tags of indexDev.html
// to get the names of all the .js files that are in the /scripts path; combine into a single file and minify it;
// create a production index.html file from the development indexDev.html input file by deleting the script tags
// for the original .js files and adding a script tag for the minified file.

var fs = require('fs');
var cheerio = require('cheerio');

var minFileName = '/min/yappee.min.js'

var indexHTML = fs.readFileSync('indexDev.html', {'encoding': 'utf-8'});                        // returns a buffer
// var indexHTML = buf.toString();

var $ = cheerio.load(indexHTML);

// parse all the script tags that are in the /scripts/ path for .js files; read the files and add the code to the
// origJS string of the combined javascript code; the path to scripts is assumed to be lib/ from the current directory
var origJS = "";
$('script').each(function() {
                   var fn = $(this).attr('src');
                   if (fn && fn.slice(0,9) == '/scripts/' && fn.slice(-3) == '.js') {
                     var jsCode = fs.readFileSync('lib' + fn, {'encoding': 'utf-8'});
                     console.log('Adding file: ' + fn);
                     origJS = origJS + jsCode + '\n';
                   }
                 });

// minify the javascript in origJS using uglify-js
// see https://github.com/mishoo/UglifyJS2 and http://lisperator.net/uglifyjs/ (API documentation)
var uglify = require('uglify-js');

var ast = uglify.parse(origJS);                      // parse code and get the initial abstract syntax tree AST
var compressor = uglify.Compressor({'drop_console': true,
                                    'unused': true,
                                    'dead_code': true,
                                    'global_defs': {MINIFIED_DEBUG: false}});    // turn off debugging output

ast.figure_out_scope();                             // analyze the tree
ast = ast.transform(compressor);                    // compress the tree
ast.figure_out_scope();                             // analyze the tree
ast.mangle_names({'toplevel': true, 'reserved': '$, _,d3,moment'});     // shorten variable names
var finalJS = ast.print_to_string();

console.log('Total length of JS files: ' + origJS.length + ' bytes originally, ' + finalJS.length + ' bytes minified.');

// write the minified JS file
fs.writeFileSync('lib' + minFileName, finalJS);

// create an index.html file for production that has the <script> tag for the minified .js file;
// delete all of the .js files in the /scripts/... path and replace them with a single <script> tag for the minified .js file
// match <script ... "/scripts/... .js" ...  ></script> followed by zero or more newlines *? is non-greedy matching of any character
var newHTML = indexHTML.replace(/ *<script.*?\"\/scripts\/.*?\.js\".*?><\/script>\n*/g, '')
                       .replace(/ *<!--(\S|\s)*?--> *\n*/g, '');                  // remove comments
var index = newHTML.search(/ *<\/body>/);
var newScript = '    <script src="' + minFileName + '" type="text/javascript"></script>\n';
newHTML = newHTML.slice(0, index) + newScript + newHTML.slice(index);

// write the modified index.html file
fs.writeFileSync('index.html', newHTML);
