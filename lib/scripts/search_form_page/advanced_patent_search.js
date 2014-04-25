// javascript for loading and setting up the Google advanced patent search page in the Search tab

function addAdvancedSearchTabClickHandler() {
// add click event handler to the 'Search' tab so when user clicks for the first time, the Google Advanced
// Patent Search form loads.
  $("a#gAdvSearchForm").on("click.loadGoogle", setupAdvancedPatentSearch);
}
  
function setupAdvancedPatentSearch() {
// click event handler for the Search tab; the first time the user clicks, load the Google advanced patent search page
// the next time, remove the click handler from the Search tab; I want to avoid automatically loading the Google content
// each time the page is loaded, even by web robots.
  var $iframe = $("iframe#gps");
  if ($iframe.attr("src") == "") {          // form has not been loaded yet
    var advancedSearchURL = "advanced_patent_search";
    // set cookie on client side which will be removed as soon as the new page loads; adding/removing is meant to prevent
    // user from entering url's like /patent/... manually in the nav bar and allowing the browser load them separately.
    // server checks for this cookie before forward request to Google.
    $.cookie("yappee_cl", clientCookie);
    $("iframe#gps").load(on_advanced_patent_search_load);
    $("iframe#gps").attr("src", advancedSearchURL);
  }
  else {                                    // form already loaded; remove click handler
    $("a#gAdvSearchForm").off("click.loadGoogle");
  }
}

function on_advanced_patent_search_load() {
  var $context = $(this).contents();
  $("head", $context).append($("script#advanced-patent-search-style").html());
  var $form = $("form[action='/patents']", $context);
  $form.children("table").first().remove();                                // remove Google header
  $form.children("table").first().before($("script#page-header").html());  // replace it with my own
  $("span#jdw-top-row", $context).append($("script#advanced-patent-search").html());
  // clean up some styling to try to make it more robust against browser variations; remove deprecated <font>
  // tags so can set the font size using css; remove styling within individual <tr> tags
  $("font", $context).each( function() {$(this).replaceWith($(this).html());});
  $("tr[style]", $context).attr("bgcolor", "ffffff").removeAttr("style");
  $("center:contains('\u00A9')", $context).remove();                 // delete Google copyright notice at bottom of page
  $form.on("submit", on_submit_advanced_patent_search);              // intercept the form submit request...
  $.removeCookie("yappee_cl");
  window.focus();

  function on_submit_advanced_patent_search(event) {
    event.preventDefault();
    var $form = $(this);
    // need to toggle form display between none/block to avoid type-ahead suggestions from appearing on the
    // search result page when user hits Enter on an input box that has a type-ahead suggestion visible.
    $form.css("display", "none");
    var searchTerms = $form.serializeArray();   // an array of objects {name: input field name, value: input field value}
    var url = $form.attr('action');
    var formData = $form.serialize();                                   // get the form query data
    make_search_result_tab(url + '?' + formData, '', searchTerms, on_search_result_complete);
  }

  function on_search_result_complete() {
  // callback for on_submit_advanced_patent_search, called when the search result page has been rendered
    // set form display back to block after the search result page is done rendering.
    $form.css("display", "block");
  }
}
