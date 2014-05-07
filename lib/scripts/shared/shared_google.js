// javascript variables and functions that are used on Google-generated pages - search, related, and patent

var nSearchResultTabs = 0, nPatentTabs = 0, nRelatedTabs = 0;

// match /patent_num?,# or end of url string; (?:...) specifies non-capturing
var rExp_patno_from_url = /\/(?:patents|related)\/(\w+)(?:[\?#%&]|$)/;

var external_URLs = ['worldwide.espacenet.com',
                     'register.epo.org',
                     'register.dpma.de',
                     'uspto.gov',
                     'wipo.int',
                     'scholar.google.com',
                     'docs.google.com',
                     'sipo',
                     '.bibtex',
                     '.enw',
                     '.ris'];

// parse patent document number of form country code, prefix, number postfix, kind code into its components; used in
// PatentPicker and makePatentLabel.
var rExpPat = /([A-Z]{2})([A-Z]*)(\d+)([A-C,G]?(?=([A-Z]\d?)?$))/

function makePatentLabel(patent_no) {
// given a valid patent_no, which can be either the full document number or the full document number without the
// kind code, return the patent number without the kind code; to be used to label patents on the force diagram,
// label patent tabs, and as the text of patent hyperlinks in biblios and patent lists.
  var rExpKC = /([A-Z]|[A-Z]\d)$/;
  return patent_no.replace(rExpKC, "");
}

function deleteTopContent($root, $target) {
// starting from the jQuery $root element, recursively delete elements that do not have $target as
// a descendant until $target is reached; do not delete script elements; called from process_search_result_contents
// and on_related_load.
  $root.children().each(checkChild);

  function checkChild() {
  // .each jQuery function to process the children of the parent element that .each was called on; 'this' is
  // each child of the body element; delete the child unless it has $target as a descendent or it is
  // a script element; recursively call deleteTopContent on a child with descendent $target until the child
  // is the target; return false halts the .each function calls
    var $child = $(this);
    if ($child.get(0) == $target.get(0)) return false;
    var $test = $child.find($target);
    if ($test.size() > 0) {
      deleteTopContent($child, $target);
      return false;
    }
    else {
      switch ($child.prop("tagName")) {
        case "SCRIPT":
          return;
        default:
          $child.remove();
      }
    }
  }
}

function process_links($context, page_type) {
// go through the hyperlinks on search, related, and patent pages and change them as needed; called from
// on_search_result_load, on_related_load, and on_patent_load.
  $("a", $context).each(function() {                   // for each link on the page
    var orig_url = $(this).attr("href");
    if (orig_url) {
      if (external_URLs.some( function(external_URL) {return orig_url.search(external_URL) >= 0 ? true : false;})) {
        $(this).on("click", on_click_external);                // open these links in a new browser tab
      }
      else {
        var strip_url = orig_url.replace('https', 'http');
        strip_url = strip_url.replace('http://www.google.com', '');  // open these links as relative to my site
        $(this).attr("href", strip_url);
        var rExp = /\/[^\?/]*[\?/]/;
        var link_match = rExp.exec(strip_url);
        var link_type = (link_match) ? link_match[0] : '';
        switch (link_type) {
          case "/patents/":
            $(this).removeAttr("onmousedown");
            if (strip_url.search('/patents/related') >= 0) {
              // when search page loads, 'related' url starts with /patents/related
              $(this).on("click", {$context: $context, page: page_type}, on_click_new_related_url);
            }
            else {
              // patent link on search or patent page, except for Grant, Application, and Also Published As which
              // have their own click handlers because we want to display them in the same tab as the original patent
              $(this).on("click", {$context: $context, page: page_type}, on_click_new_patent_url);
            }
            break;
          case "/search?":
            if (strip_url.search('&start=') >= 0) {
              $(this).on("click", on_click_more_search_result); // more search results from same page; do not open new tab
            }
            else {
              $(this).on("click", on_click_new_search_url);     // search link on search page or patent page; open new tab
            }
            break;
          case "/url?":
            if (strip_url.search('/www.google.com/patents/') >= 0) {
              // patent link on prior art page; fetches patent as query after /url?
              $(this).on("click", {$context: $context, page: page_type}, on_click_new_patent_url);
            }
            else {                            // this branch should never be called since the 'related' link on a search page
              // is processed when the page loads; after mousedown, url changes, starts with /url?
              $(this).on("click", {$context: $context, page: page_type}, on_click_new_related_url);
            }
            break;
          default:
          // there are other types of links as well which are not visible on the page
        }
      }
    };
  });

  function on_click_new_related_url(event) {
    event.preventDefault();
    event.stopPropagation();
    var related_url = $(this).attr("href");
    var patent_info = getPatentURL_No(event.currentTarget, event.data.$context, event.data.page);
    // check if the related tab for this patent already exists
    var $aTab = $("a[data-tabname='Re-" + patent_info.patent_no + "']");
    if ($aTab.length == 0) {
      // add '#c=p' suffix to load patents only; otherwise need to simulate a click on the Patents option at the
      // top of the page.
      make_related_tab(related_url + "#c=p");
    }
    else {
      $aTab.click();
    }
  }

  function on_click_more_search_result(event) {
    event.preventDefault();
    event.stopPropagation();
    var $currentIFrame = $("div.tab-pane.active iframe");                 // jQuery object - the containing iframe
    var more_results_url = $(this).attr("href");
    make_more_result_tab($currentIFrame, more_results_url);
  }

  function on_click_external(event) {
    event.preventDefault();
    event.stopPropagation();
    var external_url = $(this).attr("href");
    window.open(external_url);
  }
}

function on_click_new_patent_url(event) {
  // patent url's can be clicked on map, search, related (as a related patent or as the root patent), or patent pages
  // event.data.$context stores the jQuery context of the element that triggered the event
  // event.data.page stores the type of page the link was clicked on
  event.preventDefault();
  event.stopPropagation();
  var patent_info = getPatentURL_No(event.currentTarget, event.data.$context, event.data.page);
  var patentLabel = makePatentLabel(patent_info.patent_no);  // label for patent tab is patent_no without the kind code
  debug("In on_click_new_patent_url, make or navigate to patent tab " + patentLabel);
  patentTab(patent_info.patent_url, patentLabel);
}

function on_click_new_search_url(event) {
  event.preventDefault();
  event.stopPropagation();
  var search_url = $(this).attr("href");
  var link_text = $(this).text();
  var link_words = link_text.split(/[,\s]+/);                           // split on one or more ,whitespace
  var tab_title = 'Result';
  // mimic google patent search form input fields
  var searchTerms = [{}, {"name" : "as_drrb_is", "value": "q"}, {"name": "as_ptypeorstatus", "value": "0"}];
  if (search_url.search('ininventor') >= 0) {
    if (link_words.length > 0) {
      var last_word = link_words[link_words.length-1];
      switch (last_word.toUpperCase()) {
        case "JR": case "JR.": case "II": case "III": case "IV":
          tab_title = link_words[link_words.length-2];
          break;
        default:
          tab_title = last_word;
      }
    }
    searchTerms[0] = {"name": "as_pinvent", "value": link_text};
  }
  else if (search_url.search('inassignee') >=0) { // 
    if (link_words.length > 0) {
      tab_title = link_words.length > 1 ? link_words[0] + '...' : link_words[0];
      searchTerms[0] = {"name": "as_pasgnee", "value": link_text};
    }
  }
  else {
    debug("In on_click_new_search_url, did not match search url");
  }
  make_search_result_tab(search_url, tab_title, searchTerms, undefined);
}

function getPatentURL_No(element, $context, page_type) {
// get the patent url and number associated with an HTML element or jQuery object for the element on a page of type
// page_type ("mapped-list", "favorites-list",  "map", "main" "search", "patent", or "related")
  var patent_no = '';
  var patent_url = '';
  switch (page_type) {
    case "mapped-list": case "favorites-list":
      var $listPatent = $(element, $context).closest("div.patent-list-patent");
      var patent_no = $listPatent.attr("data-patent");
      patent_url = $listPatent.find("a.pop1-patent-url").attr("href");
      break;
    case "map":
      var $bibDiv = $(element, $context).closest("div.bib");
      patent_no = $bibDiv.attr("data-patent");
      patent_url = $bibDiv.find("a.pop1-patent-url").attr("href");
      break;
    case "main":
      // the data-patent attribute of the anchor element for a patent tab
      patent_no = $(element, $context).closest("a").attr("data-patent");
      patent_url = "/patents/" + patent_no;
      break;
    case "patent":
      patent_url = $(element, $context).attr("href");
      var link_match = rExp_patno_from_url.exec(patent_url);
      patent_no = link_match ? link_match[1] : '';
      break;
    case "search":
      var li_g = $(element, $context).closest("li.g", $context);
      patent_url = $(li_g, $context).find("cite", $context).text().replace(/www.google.com/,'');
      var link_match = rExp_patno_from_url.exec(patent_url);
      patent_no = link_match ? link_match[1] : '';
      break;
    case "related":
      var div_r = $(element, $context).closest("div.r", $context);
      patent_url = $(div_r, $context).find("cite", $context).text().replace(/www.google.com/,'');
      var link_match = rExp_patno_from_url.exec(patent_url);
      patent_no = link_match ? link_match[1] : '';
      break;
    case "related-root":
      var $div_metadata = $(element, $context).closest("div.metadata", $context);
      patent_url = $div_metadata.find("a", $context).attr("href").replace(/www.google.com/,'');
      var link_match = rExp_patno_from_url.exec(patent_url);
      patent_no = link_match ? link_match[1] : '';
    default:
  }
  return {"patent_url": patent_url, "patent_no": patent_no};
}

