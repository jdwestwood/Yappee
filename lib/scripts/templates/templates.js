// templates for _.template; to keep in file that is loaded separately from the server, cannot use the
// <script id="#xyz" type="text/template"> template html </script> method described in the underscore.js
// documentation because it only works if the templates are defined inline with the rest of the HTML for
// the site; need to define each template as a text string in javascript.

var templates = {

// replaces inline <script id="force-pop1" type="text/template"> ... </script>
// script for templating the biblio popup on the force maps; variables are patent_no, patent_label, file_date, pub_date,
// title, inventors, assignee, and abstract; be sure to escape \, ", and '!

// Firefox requires function definition before usage; Chrome does not.
  "force_pop1" :
`<% function makeLinksHTML(parseStr, queryTerm) { `}
//  // parseStr is a comma separated string of names; from each name construct an <a> tag whose href is a google patent
//  // search URL containing the query term queryTerm.
//  var aPre = \'<a class=\"pop1-search-url\" href=\"/search?tbo=p&amp;tbm=pts&amp;hl=en&amp;q=\' + queryTerm + \':%22\';
//  var aPost = \'%22\">\';
//  var aClose = \'</a>\';
//  var itemArray = parseStr.split(/\\s*,\\s*/);
//  itemArray = itemArray.map( function(name) {return aPre + name.replace(/\\s+/g, \"+\") + aPost + name;});
//  return itemArray.join(aClose + \", \") + aClose;
//  } %>
//<div class=\"pop1-container\" data-patent=\"<%= patent_no %>\">
//  <div class=\"pop1-top-capture\"></div>
//  <div class=\"pop1-patent-row\">
//    <div class=\"pop1-patent\"><a class=\"pop1-patent-url\" href=\"/patents/<%= patent_no %>\"><%= patent_label %></a></div>
 //   <div class=\"pop1-buttons\">
//      <span class=\"hide-result-btn btn-map-add\" title=\"Add to patent map\"></span>
//      <span class=\"hide-result-btn btn-favorite-add\" title=\"Add to favorites\"></span>
//      <span class=\"hide-result-btn btn-pin-add\" title=\"Pin to map\"></span>
//      <span class=\"hide-result-btn btn-hide-add\" title=\"Delete from map\"></span>
//    </div>
//    <div class=\"pop1-dates\">
//      <div>Appl: <%= file_date %></div>
//      <div>Pub: <%= pub_date %></div>
 //   </div>
//  </div>
//  <div class=\"pop1-title\"><%- title %></div>
//  <div class=\"pop1-inventors\">
//    <%= (inventors !=\"Inventors not available\") ? makeLinksHTML(inventors, \"ininventor\") : inventors %>
//  </div>
//  <div class=\"pop1-assignee\">
//    <%= (assignee != \"Assignee not available\") ? makeLinksHTML(assignee, \"inassignee\") : assignee %>
//  </div>
//  <div class=\"pop1-abstract\"><strong>Abstract</strong><br><%- abstract %></div>
//  <div class=\"pop1-top-btns\" data-patent=\"<%= patent_no %>\"></div>
//</div>
//}
