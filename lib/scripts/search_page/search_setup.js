var compiledNavTabTemplate;                                     // will be assigned in map_page_complete.js
var compiledTabContentTemplate;

// create a search result tab and process the search results from Google
function make_search_result_tab(search_url, tab_title, searchTerms, on_search_result_complete) {
// make a Google search results tab using the Google query url search_url; searchTerms is an array generated from
// the form data using jQuery .serializeArray and is used to populate the search terms summary at the top of the
// search results page and the search terms popover for the tab; on_search_result_complete is an optional
// callback called when the page is complete. 
  nSearchResultTabs += 1;
  var tab_name = (tab_title == '') ? 'S-' + nSearchResultTabs.toString() : tab_title;
  var tab_id = "searchTab_" + nSearchResultTabs;
  var tab_content_id = "result_" + nSearchResultTabs;
  var iframe_id = "gps_result_" + nSearchResultTabs;
  var navTabHTML = compiledNavTabTemplate({tab_id: tab_id, tab_content_id: tab_content_id, tab_name: tab_name});
  var tabContentHTML = compiledTabContentTemplate({tab_content_id: tab_content_id, iframe_id: iframe_id,
                                                   iframe_width: 1050, iframe_height: googleIFrameHeight});
  $("div.tab-pane.active").after(tabContentHTML);
  $("ul#topTabs li.active").after(navTabHTML);
  // table at the top of the search result page
  var searchTermsTable = new HTMLSummaryTable("script#search-term-table", searchTerms);
  // table in the popover for the page
  var popoverTable = new HTMLSummaryTable("script#search-term-popover", searchTerms);
  var $iframe = $("iframe#" + iframe_id)
  $iframe.css("visibility", "hidden")
         .on("load", on_search_result_load);
  $.cookie("yappee_cl", clientCookie);
  $("iframe#" + iframe_id).attr("src", search_url);

  function on_search_result_load() {
    var $context = $(this).contents();       // 'this' is the iframe HTML element
    process_links($context, "search");       // make google links point to my server
    process_search_result_contents($context, searchTermsTable.html());       // set up search terms summary at top of page
    tabPopoverManager.setupSearchTabPopover(tab_id, popoverTable.html());    // set up popover for the tab for this page
    $("a#" + tab_id).tab("show");
    window.scrollTo(0,0);
    window.focus();
    window.setTimeout(function() {$iframe.css("visibility", "visible");}, 1000);
    window.setTimeout(function() {$.removeCookie("yappee_cl");}, 1500);
    if (on_search_result_complete) {
      on_search_result_complete();
    }
  }
}

function process_search_result_contents($context, htmlSearchTermsTable) {
// process the content of a search page
  $("head", $context).append($("script#search-term-table-style").html());  // append style for the replacement page header
  $("body", $context).addClass("make-invisible");          // so user does not see the web page manipulations
  deleteBottomContent();
  // contents() gets both text nodes and elements; remove the hyphen and the 'Discuss' link at bottom of each search entry
  $("div.osl", $context).each ( function() { $(this).contents().slice(-2).remove();} );
  var $saveStyle = $("div#cst", $context);                     // need to save the styling in this div
  // delete the Google content at the top of the page down to div#center_col.
  deleteTopContent($("body", $context), $("div#center_col", $context));
  $("body", $context).prepend($saveStyle);                     // reattach styling for the search page
  $("body", $context).prepend($("script#page-header").html()); 
  $("span#jdw-top-row", $context).append(htmlSearchTermsTable);          // append html for the search term table
  $("body", $context).append($("script#search-page-more-results-style").html());  // append style for Goooogle page links
  $("li.g", $context).each(deleteNonPatents);                            // get rid of occasion Wikipedia links
  $("li.normal-footer, li.normal-footer + hr.rgsep", $context).remove(); // and associated elements
  $("body", $context).removeClass("make-invisible");
  // buttons to map, add to favorites, or hide patent
  // put all css floated buttons before the patent link so they are rendered first and stay on the same line;
  $("div#ires h3.r", $context).prepend($("script#search-page-button-content").html());
  $("li.g span.btn-hide-add", $context).on("click", function(event) {on_click_hide_button(event, $context); });
  $("li.g span.btn-map-add", $context)
      .each(function() {
         var patent_no = getPatentURL_No(this, $context, "search").patent_no;
         $(this).attr("data-patent", patent_no).on("click", {$context: $context, page: "search"}, on_click_map_buttons);
         if (patentLists["map"].indexOf(patent_no) != -1) $(this).addClass("show-result-btn");
       });
  $("li.g span.btn-favorite-add", $context)
      .each(function() {
         var patent_no = getPatentURL_No(this, $context, "search").patent_no;
         $(this).attr("data-patent", patent_no).on("click", {$context: $context, page: "search"}, on_click_map_buttons);
         if (patentLists["favorites"].indexOf(patent_no) != -1) $(this).addClass("show-result-btn");
       });
  $("div#res", $context).before($("script#search-page-unhide-results").html()); // html to unhide hidden results
  $("span.hidden-results-message", $context).data("nHidden", 0);
  $("span.hidden-results-clear-btn", $context).on("click", function(event) {on_click_show_hidden(event, $context); });

  function deleteBottomContent() {
  // at the bottom of a search result page
    // 4/2/2014 the following three elements seem to no longer be present
    $("p#bfl", $context).parent().remove();                      // advanced search and other links
    $("div#gfn", $context).remove();                             // empty div
    $("div#fll", $context).remove();                             // Google home and other links

    $("div#footcnt", $context).remove();                         // Help Feedback Privacy
  }

  function deleteNonPatents() {
  // check the cite element of each li.g to see if it is a patent link; if not, delete it; stop looking after
  // encountering the first patent link by return false per jQuery documentation.
    var $cite = $(this).find("cite");
    if ($cite.size() > 0) {
      var citeText = $cite.text();
      var link_match = rExp_patno_from_url.exec(citeText);
      if (link_match) {
        return false;                                           // stops jQuery each loop
      }
      else {
        $(this).remove();
      }
    }
    else {
      $(this).remove();
    }
  }
}

function on_click_show_hidden(event, $context) {
// click event handler for the 'Show all' button on the search results page that unhides hidden results
  $(event.target, $context).parent().addClass("hidden-show-all");    // the containing div element for the 'Show all' button
  $("li.hide-result", $context).removeClass("hide-result");
  $("span.hidden-results-message", $context).data('nHidden', 0);
}

function on_click_hide_button(event, $context) {
// click event handler for the 'hide' button on the search results page
  var pressedButton = $(event.target, $context);
  var assocResult = pressedButton.closest("li.g", $context);
  assocResult.addClass("hide-result");
  var $hiddenMessage = $("span.hidden-results-message", $context);
  var curCount = $hiddenMessage.data("nHidden") + 1;
  $hiddenMessage.data("nHidden", curCount);                           // update the count of hidden patent results
  if (curCount == 1) {
    $hiddenMessage.text(curCount.toString() + ' result hidden below.');
  }
  else {
    $hiddenMessage.text(curCount.toString() + ' results hidden below.');
  }
  $("div.hidden-results-info", $context).removeClass("hidden-show-all")
}

function make_more_result_tab($iframe, more_result_url) {
// load more search results into the current iframe ($iframe is a jQuery object)
  htmlSearchTermsTable = $("div#jdw1", $iframe.contents()).clone();
  $iframe.off("load");                                          // remove original search result load event handler
  $iframe.css("visibility", "hidden")
         .on("load", {"htmlSearchTermsTable": htmlSearchTermsTable}, on_more_result_load);
  $.cookie("yappee_cl", clientCookie);
  $iframe.attr("src", more_result_url);

  function on_more_result_load(event) {
    var $context = $(this).contents();
    process_links($context, "search");
    process_search_result_contents($context, event.data.htmlSearchTermsTable);
    // htmlSearchTermsTable has been cloned from the original search page; popover has already been attached to the tab
    $.cookie("yappee_cl", clientCookie);
    window.scrollTo(0,0);
    window.focus();
    window.setTimeout(function() {$iframe.css("visibility", "visible");}, 1000);
  }
}

function HTMLSummaryTable(scriptName, searchTerms) {
// class to create and populate the html template defined in scriptName with a table of searchTerms; called from
// make_search_result_tab to create HTML for the search terms table and the popover table of search terms; gets
// the search terms from the Google advanced patent search form or from a searchTerms array created when the user
// clicks on author or assignee links in tabs or biblios.

  this.html = function() {
    var templateVars = makeTemplateVars(searchTerms);
    return _.template( $(scriptName).html(), templateVars);
  }

  function makeTemplateVars(searchTerms) {
  // return an object containing the names and values of the search terms to be templated
    var templateVars = initializeTemplateVars();
    var searchFormNames = initializeFormNames();
    var dateInfo = {};
    var inputName = '', entryName = '', entryValue = '';
    var maxChar = 25;
    var tableEntry = 0;
    searchTerms.forEach( function(inputField) {
      inputName = inputField["name"];
      if (searchFormNames.formFields[inputName]) {      // there are some input fields we have not defined in .formFields
        entryName = searchFormNames.formFields[inputName];
        entryValue = inputField["value"];
        switch (entryName) {
          case "All of: ": case "Exactly: ": case "At least one: ": case "None of: ": case "Patent: ":
          case "Title: ": case "Inventor: ": case "Assignee: ": case "US class: ": case "Intl class: ": case "Coop class: ":
            if (entryValue != "") {
              tableEntry += 1;
              templateVars["t"+tableEntry] = entryName;
              // no need to truncate long strings; CSS of the class .vcell takes care of it!
              templateVars["v"+tableEntry] = entryValue;
            }
            break;
          case "Type: ": case "ChkBoxPatDateOptions": case "MinMonth": case "MinYear": case "MaxMonth":
          case "MaxYear": case "Restrict by":
            dateInfo[entryName] = entryValue;                 // need to store these values and process them separately
            break;
        }
      }
    });

    tableEntry = 4*Math.ceil(tableEntry/4);                            // round to nearest multiple of 4
    tableEntry += 1;
    templateVars["t"+tableEntry] = "Type: ";                      // put in the last column in the table
    templateVars["v"+tableEntry] = searchFormNames.type[dateInfo["Type: "]];
    if (dateInfo["ChkBoxPatDateOptions"] == 'q') {                     // no restriction on date
      tableEntry += 1;
      templateVars["t"+tableEntry] = "Date: ";
      templateVars["v"+tableEntry] = "Any";
    }
    else {                                                             // process the date restrictions
      tableEntry += 1;
      templateVars["t"+tableEntry] = "Start date: ";
      if (dateInfo["MinYear"] == "") {
        templateVars["v"+tableEntry] = "Any";
      }
      else {
        templateVars["v"+tableEntry] = searchFormNames.month[dateInfo["MinMonth"]] + dateInfo["MinYear"];
      }
      tableEntry += 1;
      templateVars["t"+tableEntry] = "End date: ";
      if (dateInfo["MaxYear"] == "") {
        templateVars["v"+tableEntry] = "Any";
      }
      else {
        templateVars["v"+tableEntry] = searchFormNames.month[dateInfo["MaxMonth"]] + dateInfo["MaxYear"];
      }
      tableEntry += 1;
      templateVars["t"+tableEntry] = "Restrict by: ";
      templateVars["v"+tableEntry] = searchFormNames.restrictBy[dateInfo["Restrict by"]];
    }
    return templateVars
  }

  function initializeFormNames() {
  // used translate form values in the Google advanced patent search form to names used in the search term
  // summary on a search tab
    return {                             // translate form fields to names used in the search term summary table
    "formFields" : {
      "as_q" : "All of: ",
      "as_epq" : "Exactly: ",
      "as_oq" : "At least one: ",
      "as_eq" : "None of: ",
      "as_pnum" : "Patent: ",
      "as_vt" : "Title: ",
      "as_pinvent" : "Inventor: ",
      "as_pasgnee" : "Assignee: ",
      "as_pusc" : "US class: ",
      "as_pintlc" : "Int'l class: ",
      "as_pcoopc" : "Coop class: ",
      "as_ptypeorstatus" : "Type: ",
      "as_drrb_is" : "ChkBoxPatDateOptions",    // value 'q' anytime; value 'b' between dates
      "as_minm_is" : "MinMonth",
      "as_miny_is" : "MinYear",
      "as_maxm_is" : "MaxMonth",
      "as_maxy_is" : "MaxYear",
      "as_pdatetype" : "Restrict by"          // value '1' application date; value '2' issue date
      },
    "type" : {
      "0" : "Any", "1" : "Application", "2" : "Issued", "3" : "Utility", "4" : "Design", "5" : "Plant",
      "6" : "Other", "7" : "Other", "8" : "Other"
      },
    "restrictBy" : {
      "1" : "Appl. date", "2" : "Issue date"
      },
    "month" : {
      "0" : "", "1" : "Jan ", "2" : "Feb ", "3" : "Mar ", "4" : "Apr ", "5" : "May ", "6" : "Jun ",
      "7" : "Jul ", "8" : "Aug ", "9" : "Sep ", "10" : "Oct ", "11" : "Nov ", "12" : "Dec "
      }
    };
  }

  function initializeTemplateVars() {
  // initialize the object that will be passed to the templating engine to populate the search terms table
    return {
      "t1" : "", "v1" : "",
      "t2" : "", "v2" : "",
      "t3" : "", "v3" : "",
      "t4" : "", "v4" : "",
      "t5" : "", "v5" : "",
      "t6" : "", "v6" : "",
      "t7" : "", "v7" : "",
      "t8" : "", "v8" : "",
      "t9" : "", "v9" : "",
      "t10" : "", "v10" : "",
      "t11" : "", "v11" : "",
      "t12" : "", "v12" : "",
      "t13" : "", "v13" : "",
      "t14" : "", "v14" : "",
      "t15" : "", "v15" : "",
      "t16" : "", "v16" : ""
    };
  }
}
