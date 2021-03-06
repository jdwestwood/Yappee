// javascript for TabPopoverManager, which takes care of creating and managing popovers for the tabs

var compiledPatentPopover;
var compiledRelatedPopoverTitle;
var compiledRelatedPopoverContent;
var tabPopoverManager = new TabPopoverManager();

function TabPopoverManager() {
// constructor for a tabManager that takes care of creating and managing the popovers for the tabs

  this.setupInitialTabs = function() {
    // append customized bootstrap styles (for tabs and popover html content)
    $("head").append($("script#customize-bootstrap-styles").html());
    var aTab = $("a[data-toggle='tab']");
    // setup eventListeners on Map and Search tabs so popovers on other tabs are disabled/reenabled correctly
    aTab.on('shown.bs.tab', this.on_tab_shown.bind(this));
  }

  this.on_tab_shown = function(event) {
  // handler for the click event on tabs
    var $clickedTab = $(event.target);
    if ($clickedTab.data('bs.popover')) {
      $clickedTab.popover('hide');              // was already hovering before the click; make it disappear
      $clickedTab.popover('disable');           // prevent it from popping up again
    }
    if (event.relatedTarget) {
      var $previousTab = $(event.relatedTarget);
      if ($previousTab.data('bs.popover')) {
        $previousTab.popover('enable');
        var tab_id = $previousTab.attr("id");
        if (tab_id.slice(0,10) == 'relatedTab') {         // update the popover content of a related tab
          updateRelatedTabPopover($previousTab);
        }  
      }
    }
  }

  this.setupPatentTab = function(tab_id, $context) {
  // tab has already been labeled with patentLabel (patent number without the kind code) in make_patent_tab;
  // need to get the full patent number with kind code by parsing the Google patent document and add it as an
  // attribute to the tab; the full patent_no is used internally by the program; return the full patent_no;
  // called from on_patent_load. 
    var patent_no = getPatentNo($context);         // get full patent document number by parsing Google patent document
    var tia = getTIA($context);                    // object containing title, inventors, assignees for the patent
    var inventors = tia.inventors.replace(/, (?!Jr|JR|II|IV)/g,'<br/>');     // x(?!y) matches x only if not followed by y
    var assignee = tia.assignee.replace(/, (?!Jr|JR|II|IV)/g,'<br/>');
    var htmlPopoverContent = compiledPatentPopover({inventors: inventors, assignee: assignee} );
    var aTab = $("a#" + tab_id).attr("data-patent", patent_no);
    setupMapFavButtons(aTab, document, "main", patent_no);
    setupPopover(aTab, tia.title, htmlPopoverContent, "jdwpatent");          // add the popover
    aTab.on('shown.bs.tab', this.on_tab_shown.bind(this));
    return patent_no;

    function getPatentNo($context) {
    // get the full patent number from a Google patent document $context; used to associate a patent tab label (patent
    // number without the kind code) with the full patent document number used in Google links and EPO querying except
    // for US patents; called in tabPopoverManager in .setupPatentTab.
      var patent_no = $("span.patent-number", $context).text();
      if (patent_no) {
        patent_no = patent_no.replace(/\s/g, "");
        if (patent_no.slice(0,2) == "US") {                       // Google patent links for US patents do not have a kind code
          patent_no = patent_no.replace(/[A-Z]?\d?$/, "");        // so strip it off
        }
      }
      return patent_no;
    }
  }

  function setupPopover(aTab, title, content, className) {
    aTab.popover( {placement: "bottom", trigger: "hover", html: true, title: title,
                   content: content} );                     // or use trigger: "click" to debug
    aTab.popover('disable');                                // disable initially since we are already looking at this tab
    var popoverObject = aTab.data('bs.popover');            // get reference to popover instance; the .tip() method
    // returns the top div element of the popover so can add my own css.
    $(popoverObject.tip()).addClass(className).children("div,h3").addClass(className);
  }

  this.setupSearchTabPopover = function(tab_id, htmlPopoverTable) {
  // called from on_search_result_load.
    var aTab = $("a#" + tab_id);
    setupPopover(aTab, "Search", htmlPopoverTable, "jdwsearch")
    aTab.on('shown.bs.tab', this.on_tab_shown.bind(this));
  }

  this.setupPriorArtTabPopover = function(tab_id, $context) {
    // uses data from the div.meta secton so need to wait until it is finished loading asynchronously before
    // calling this function; called from on_divmeta_added.
    var patent_no = $("div#patent-metadata-box h2 a", $context).text();
    var patent_title = $("div#patent-metadata-box div#title", $context).text();
    var searchEntries = extractPriorArtSearchEntries($context);
    var htmlPopoverTitle = compiledRelatedPopoverTitle({patent_no: patent_no, patent_title: patent_title});
    var htmlPopoverContent = compiledRelatedPopoverContent({searchTerms: searchEntries.searchTerms,
                                                            startDate: searchEntries.startDate, endDate: searchEntries.endDate});
    var aTab = $("a#" + tab_id);
    setupPopover(aTab, htmlPopoverTitle, htmlPopoverContent, "jdwprior");
    // note that event handler for the 'show' event must be attached earlier for a prior art page due to the div.r's
    // and div.meta's loading asynchronously
  }

  function updateRelatedTabPopover($aTab) {
    // $aTab is a jQuery object containing the <a> element that is used to activate a bootstrap tab
    var divID = $aTab.attr("href");         // need to get the document in iframe of the div element associated with this tab
    var $context = $("div"+divID+" iframe").contents();
    var searchEntries = extractPriorArtSearchEntries($context);
    var popoverObject = $aTab.data('bs.popover');                     // get reference to popover instance; the .tip() method
    var popoverObjectContent = popoverObject.options.content;         // get popover html content
    var $popoverObjectContent = $(popoverObjectContent, popoverObjectContent);    // make into a jQuery object
    var $newTDsearch = $("td#jdw-pop-search-terms", popoverObjectContent).html(searchEntries.searchTerms);
    var $newTDstartDate = $("td#jdw-pop-start-date", popoverObjectContent).html(searchEntries.startDate);
    var $newTDendDate = $("td#jdw-pop-end-date", popoverObjectContent).html(searchEntries.endDate);
    $("td#jdw-pop-search-terms", $popoverObjectContent).replaceWith($newTDsearch);
    $("td#jdw-pop-start-date", $popoverObjectContent).replaceWith($newTDstartDate);
    $("td#jdw-pop-end-date", $popoverObjectContent).replaceWith($newTDendDate);
    popoverObject.options.content = $popoverObjectContent[0].outerHTML;
  }

  function extractPriorArtSearchEntries($context) {
    // extract patent number, title, search terms, and search dates for popover
    var searchTerms = '';
    $("div.search-term-wrapper span.jfk-checkbox-checked", $context).parent().parent()
      .each( function(index) {
               if (index == 0) {
                 searchTerms += $(this).text().trim();
               }
               else {
                 searchTerms += '<br>' + $(this).text().trim();
               }
             });
    var startDate = $("tr#start-date input", $context).val();
    if (startDate == '') startDate = 'Any';
    var endDate = $("tr#end-date input", $context).val();
    if (endDate == '') endDate = 'Any';
    return {searchTerms: searchTerms, startDate: startDate, endDate: endDate};
  }

  this.deleteTab = function(event) {
  // handler for the click event on the delete button at the upper right corner of every tab; attached using 'onclick'
  // in the button HTML element for the delete button
    var clickedButton = $(event.target);
    var assocTab = clickedButton.closest("a");             // previous sibling element of the parent
    var activeTab = $("li.active > a");
    if (activeTab.get(0) == assocTab.get(0)) {             // are the HTML elements the same (the jQuery objects are not!)
        nextTab = assocTab.parent().prev().children("a");  // the previous tab
      }
      else {
        nextTab = activeTab
    }
    nextTab.tab("show");          // show nextTab before deleting the clicked tab and its content so popovers behave properly
    // remove the content of the tab; (the href of the anchor starts with '#' and references the div)
    $("div"+assocTab.attr("href")).remove();
    clickedButton.closest("li").remove();                // remove the list element for the tab itself
  }
}
