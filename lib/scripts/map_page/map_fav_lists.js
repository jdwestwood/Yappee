// javascript for the Mapped and Favorite patent lists on the Map page

var compiledMappedListEntryTemplate;                                    // will be assigned in map_page_complete.js
var compiledFavoritesListEntryTemplate;
var compiledPatentListBiblioTemplate;
var compiledPatentListCitationsTemplate;
var $mappedList = $("div.patent-list[data-listname='mapped']");         // global variables for the jQuery elements for the
var $favoritesList = $("div.patent-list[data-listname='favorites']");   // Mapped and Favorites lists on the Mapped page

function addTargetPatentToMappedSublist($sourceContainer, source_patent, target_patent, citation_type, undeleted) {
// add the biblio info for target_patent to the list of referenced patents of type 'type' for source_patent in the
// Mapped patent list; 'type' is 'cited', 'citing', or 'related'; $sourceContainer is the div.patent-list-patent-container
// for the source patent in the Mapped patent list; 'undelete' is a boolean indicating whether target_patent was
// deleted and then undeleted; called from addEPOPatentDataToForceMap and mapExistingTargetPatents
  // addTargetPatentToForceMap has already been called, so patent will only be in patentsPlotted if it was not
  // deleted previously
  var $citationSectionHeading = $sourceContainer.find("div.patent-list-" + citation_type + "-heading");
  if (target_patent in patentsPlotted) {
    incrementCitationCount($citationSectionHeading, "mapped", 1);
    if (undeleted) {
      incrementCitationCount($citationSectionHeading, "deleted", -1);
    }
    var $refsContainer = $sourceContainer.find("div.patent-list-" + citation_type +
                                               "-patents div.patent-list-subpatent-container");
    var refBiblio = epoBiblio[target_patent];
    var refPatentHTML = compiledPatentListBiblioTemplate(
                        {"patent_no": target_patent, "patent_label": makePatentLabel(target_patent),
                         "source_patent": source_patent, "title": refBiblio["title"], "file_date": refBiblio["file_date"]});
    $refsContainer.append(refPatentHTML);
    var $refPatent = $refsContainer.find("div.patent-list-patent[data-patent='" + target_patent + "']");
    setupMapFavButtons($refPatent, document, "mapped-list", target_patent);
    setupDeleteButton($refPatent, target_patent);
    setupPatentLink($refPatent, "mapped-list");
    setupPatentHighlight($refPatent, target_patent, "mapped-list");
    setupPatentFullView($refPatent, target_patent, "mapped-list");
  }
  else {
    incrementCitationCount($citationSectionHeading, "deleted", 1);
  }
}

function addSourcePatentToMappedList(patent_no) {
// create an entry for patent_no in the Mapped patents list on the Mapped page; uses global variables
// $mappedList and patentBiblio; called from processSourcePatent.
  var patentObj = patentBiblio[patent_no];
  var patentEntryHTML = compiledMappedListEntryTemplate({"patent_no": patent_no});
  $mappedList.find("div.patent-list-patents").prepend(patentEntryHTML);                         // add at beginning of list
  var $patentEntry = $mappedList.find("div.patent-list-entry[data-patent='" + patent_no + "']");
  var $patentContainer = $patentEntry.find("div.patent-list-patent-container");
  var patentSectionHTML = compiledPatentListBiblioTemplate(
                          {"patent_no": patent_no, "patent_label": makePatentLabel(patent_no), "source_patent": patent_no,
                           "title": patentObj["title"], "file_date": patentObj["file_date"]});
  $patentContainer.append(patentSectionHTML);
  nCited = patentObj["cited_patents"].length;
  nCiting = patentObj["citing_patents"].length;
  nRelated = patentObj["related_patents"].length;
  var citedSectionHTML = compiledPatentListCitationsTemplate(
         {"patent_no": patent_no, "citation_type": "cited", "citation_no": nCited, "citation_heading": "Cited patents"});
  var citingSectionHTML = compiledPatentListCitationsTemplate(
         {"patent_no": patent_no, "citation_type": "citing", "citation_no": nCiting, "citation_heading": "Citing patents"});
  var relatedSectionHTML = compiledPatentListCitationsTemplate(
         {"patent_no": patent_no, "citation_type": "related", "citation_no": nRelated,
          "citation_heading": "Related patents - Google"});
  $patentContainer.append(citedSectionHTML);
  $patentContainer.append(citingSectionHTML);
  $patentContainer.append(relatedSectionHTML);
  // add click handlers for dropdown/dropup arrows
  $patentEntry.find("div.patent-list-dropdown-arrow").on("click", on_click_patent_dropdown);
  $patentContainer.find("div.citation-list-dropdown-arrow").on("click", on_click_citation_dropdown);
  setupMapFavButtons($patentContainer, document, "mapped-list", patent_no);
  setupDeleteButton($patentContainer, patent_no);
  setupPatentLink($patentContainer, "mapped-list");
  setupPatentHighlight($patentContainer, patent_no, "mapped-list");
  setupPatentFullView($patentContainer, patent_no, "mapped-list");

  function on_click_patent_dropdown(event) {
  // when user clicks on the dropdown/dropup arrow for a patent entry in the Mapped list
    var $dropArrow = $(this);
    var $patentEntry = $dropArrow.closest("div.patent-list-entry");
    var $patentEntryContainer = $patentEntry.closest("div.patent-list-patents");
    var $refSections = $patentEntry.find("div.patent-list-references");
    if ($dropArrow.hasClass("patent-list-dropup-arrow")) {                // hide the dropdown content
      $dropArrow.removeClass("patent-list-dropup-arrow");
      $refSections.removeClass("make-displayed-flex");
      $patentEntryContainer.css("min-height", "0px");
    }
    else {                                                                // display the dropdown content
      $dropArrow.addClass("patent-list-dropup-arrow");
      $refSections.addClass("make-displayed-flex");
      $patentEntryContainer.css("min-height", "118px");
    }
  }

  function on_click_citation_dropdown(event) {
  // when user clicks on the dropdown/dropup arrow for a cited, citing, or related patent section of a patent
  // entry in the Mapped list
    var $dropArrow = $(this);
    var $refSection = $dropArrow.closest("div.patent-list-references");
    var $mainContainer = $refSection.closest("div.patent-list-patents");
    var mainContainerHeight = $mainContainer.css("height");       // e.g., "50px"
    var curMainHeight = parseInt(mainContainerHeight.slice(0, mainContainerHeight.length - 2));
    var patent_no = $refSection.attr("data-patent");
    var citation_type = $refSection.attr("data-citation-type");
    var $refsContainer = $refSection.find("div.patent-list-subpatent-container");
    if ($dropArrow.hasClass("citation-list-dropup-arrow")) {             // hide the dropdown content
      $dropArrow.removeClass("citation-list-dropup-arrow");
      $refsContainer.removeClass("make-displayed-flex");
      $refSection.css("height", "25px");
      $mainContainer.css("height", (curMainHeight - 47) + "px");
    }
    else {                                                                // display the dropdown content
      $dropArrow.addClass("citation-list-dropup-arrow");
      $refsContainer.addClass("make-displayed-flex");
      $refSection.css("height", "72px");
      $mainContainer.css("height", (curMainHeight + 47) + "px");
    }
  }
}

function incrementCitationCount($citationSectionHeading, count_type, increment) {
// change the count of count_type 'mapped' or 'deleted' citations by increment for citations of type
// citation_type under the $citationSectionHeading jQuery element (div.patent-list-'citation_type'-heading).
// called from addTargetPatentToMappedSublist and deletePatentFromMappedSublists
  switch (count_type) {
    case "mapped":
      var $spanCount = $citationSectionHeading.find("span.patent-list-citation-mapped");
      break;
    case "deleted":
      var $spanCount = $citationSectionHeading.find("span.patent-list-citation-deleted");
      break;
  }
  var newCount = parseInt($spanCount.text()) + increment;
  $spanCount.text(newCount.toString());
}

function setupPatentFullView($patContext, patent_no, page_type) {
  $patContext.find("div.patent-list-fullview-button")
             .on("mouseover", {patent_no: patent_no, page_type: page_type}, on_mouseover_fullview_button)
             .on("mouseout", {patent_no: patent_no, page_type: page_type}, on_mouseout_fullview_button);
}

function on_mouseover_fullview_button(event) {
// handler for mouseover event on the fullview button for a patent in the Mapped or Favorites List on the Map page      
  var $fullBtn = $(this);
  // to avoid multiple queries when multiple events are triggered in quick succession
  if ($fullBtn.attr("data-querying") == "true") return;
  var patent_no = event.data.patent_no;
  var patentObj = (patentBiblio[patent_no]) ?
                   patentBiblio[patent_no] : ((epoBiblio[patent_no]) ? epoBiblio[patent_no] : undefined);
  if (!patentObj) {                                         // occurs when patent is in the Favorites list
    var epoPatList = makeEPOQueryList([patent_no]);         // Google format to EPO format
    $fullBtn.attr("data-querying", "true");
    taskTracker.initialize("Fetching additional data", undefined);
    taskTracker.startTask(1);
    getEPOPatentData(epoPatList, on_EPO_query_success);
  }
  else {
    setupFullView(patent_no, patentObj);
  }

  function on_EPO_query_success(data) {
    var processedList = parseEPOPatentData(data);
    taskTracker.finishTask(1);
    $fullBtn.attr("data-querying", "false");
    if (processedList) {
      var patentObj = epoBiblio[patent_no];
      if (patentObj) {
        debug("In on_mouseover_fullview_button, got EPO API for patent " + patent_no);
        setupFullView(patent_no, patentObj);
      }
      else {
        debug("In on_mouseover_fullview_button, no data in epoBiblio for patent " + patent_no);
      }
    }
    else {
      debug("In on_mouseover_fullview_button, failed to get EPO data for patent " + patent_no);
    }
  }

  function setupFullView(patent_no, patentObj) {
    var pop1HTML = compiledPop1Template({patent_no: patent_no, patent_label: makePatentLabel(patent_no),
                           file_date: patentObj.file_date, pub_date: patentObj.pub_date, title: patentObj.title,
                           inventors: patentObj.inventors, assignee: patentObj.assignee, abstract: patentObj.abstract});
    var divFullView = $fullBtn.find("div.patent-list-fullview-container").html(pop1HTML);
    var divFVPos = divFullView.offset();
    var divPop = divFullView.find("div.pop1-container").addClass("pop1-in-patent-list");
    divPop.css("top", (divFVPos.top - 3) + "px").css("left", (divFVPos.left - pList.w - 12) + "px");
    divPop.find("div.pop1-top-capture").remove();
    divPop.find("div.pop1-buttons").remove();
    divPop.find("div.pop1-top-btns").remove();
    divPop.find("div.pop1-inventors").addClass("make-displayed");
    divPop.find("div.pop1-abstract").addClass("make-displayed");
  }
}

function on_mouseout_fullview_button(event) {
  var patent_no = event.data.patent_no;
  $(this).find("div.pop1-container").remove();
}

function setupPatentHighlight($patentContainer, patent_no, page_type) {
// setup mouseover and mouseout event handlers for patent biblio in the Mapped or Favorites Lists on the Map page
  if ($patentContainer.hasClass("patent-list-patent")) {        // called from addTargetPatentToMappedSublist
    $patentContainer.on("mouseover", {patent_no: patent_no, page_type: page_type}, on_mouseover_patent_list_patent)
                    .on("mouseout", {patent_no: patent_no, page_type: page_type}, on_mouseout_patent_list_patent);
  }
  else {                             // called from addSourcePatentToMappedList and addFavoritePatentToFavoritesList
    $patentContainer.find("div.patent-list-patent")
                    .on("mouseover", {patent_no: patent_no, page_type: page_type}, on_mouseover_patent_list_patent)
                    .on("mouseout", {patent_no: patent_no, page_type: page_type}, on_mouseout_patent_list_patent);
  }
}

function on_mouseover_patent_list_patent(event) {
// handler for mouseover on a biblio in the Mapped or Favorites Lists on the Map page; highlight the patent and links on the
// force map that the mouse is over in the list
  var patent_no = event.data.patent_no;
  var page_type = event.data.page_type;                         // 'mapped-list' or 'favorites-list'
  if (patentsPlotted[patent_no]) {                              // if patent is mapped (might not be if on Favorites list)
    highlightLinks(patent_no);
    var marker = d3.select("g.force-patent-marker[data-patent=" + patent_no + "]");
    updateMarkerOnForceMap(marker, page_type);        
  }
}

function on_mouseout_patent_list_patent(event) {
// handler for mouseout on a biblio in the Mapped or Favorites Lists on the Map page;
// unhighlight the patent and links on the force map that the mouse was over in the list
  var patent_no = event.data.patent_no;
  mouseout_patent_list_patent(patent_no);
}

function mouseout_patent_list_patent(patent_no) {
// called from on_mouseout_patent_list_patent event handler and special cases in removePatentFromFavorites
// and removePatentFromMapped
  if (patentsPlotted[patent_no]) {                              // if patent is mapped (might not be if on Favorites list)
    unhighlightLinks(patent_no);
    var marker = d3.select("g.force-patent-marker[data-patent=" + patent_no + "]");
    updateMarkerOnForceMap(marker, "map");
  }
}

function setupPatentLink($linkContext, page_type) {
// called from addSourcePatentToMappedList, addTargetPatentToMappedList, and addFavoritePatentToFavoritesList
// set up event handler for click on a patent link in the list; $linkcontext is the jQuery element that
// contains the link for patent_no.
  $("a.pop1-patent-url", $linkContext).on("click", {$context: $linkContext, page: page_type}, on_click_new_patent_url);
}

function setupDeleteButton($btnContext, patent_no) {
// called from addSourcePatentToMappedList, addTargetPatentToMappedList, and addFavoritePatentToFavoritesList;
// set up event handler for click on the 'Delete' button for patent patent_no in the list; $btnContext is the
// jQuery element that contains the 'Delete' button span element for patent patent_no.
  var $deleteBtn = $btnContext.find("span.btn-hide-add");
  if ((patent_no in patentsPlotted)) {                // if patent_no is mapped (as either a source or target patent)
    $deleteBtn.on("click", {patent_no: patent_no}, on_click_delete_btn$);  // add click event handler to 'Delete' button
    $deleteBtn.removeClass("make-not-displayed");
  }
  else {                                              // do not display the 'Delete' button if patent no is not on the map
    $deleteBtn.addClass("make-not-displayed");
  }
}

function on_click_delete_btn$(event) {
// for click event handler attached to Mapped or Favorites list 'Delete' buttons using jQuery;
// like on_click_delete_btn attached to force map biblios using d3.
  $(this).addClass("make-not-displayed");
  deletePatentFromMap(event.data.patent_no, "single", on_delete_complete);

  function on_delete_complete() {
    setUndoButtonState();     // set Undo button state based on whether deleted list has any patents in it
    setClearButtonState();    // will set Clear button state based on whether patentsPlotted still has any patents in it
  }
}
