// javascript for adding and deleting patents from the force map

var startTime;                     // for debugging elapsed time
// list of objects containing patent bibliographic, cited, citing, and related patent info; used for querying EPO for mapping

var taskTracker = new TaskTracker();   // tracks queries and updates status line at top of patent map

var patentBiblio = {};
// list of objects containing patent bibliographic data, but no citation or related patent info; used for favorites list
var favoriteBiblio = {};
var epoBiblio = {};                // contains the bibliographic data fetched from EPO
var patentNoEPOtoGoogle = {};      // a dictionary of epo patent document keys and Google patent document values
var patentLists = {                // simple lists of patent numbers for each kind of list
   "map": [],
   "favorites": [],
   "deleted": [],                  // track order that patents are deleted, so deletions can be undone
   "cleared":
             {"map": [],
              "target": [],
              "deleted": []
             },
   "clearFlag": false              // flag set after user clicks the Clear button
};

var patentNodes = [];                                // forcePatent map patent nodes
var biblioNodes = [];                                // forceBiblio map biblio nodes (no force map links for biblioNodes)
var patentLinks = [];                                // rendered as forcePatent map pLink link lines
var biblioLinks = [];          // rendered as bLink link lines between patentNodes and biblioNodes (are NOT force map links)
// dictionary of patents currently plotted on forcePatent and forceBiblio maps; keys are patent nos.; values are patentNodes
var patentsPlotted = {};
// dictionary of patents that were plotted but then removed due to user unmapping an associated source patent
// (not deleted by the user)
var patentsUnplotted = {};
// dictionary of patents that have been deleted from map by the user clicking the delete button; used for undo
// dictionary of all patents that have ever been plotted on the map; keys are patent nos.; values are patentNodes
var patentsHistory = {};

var d3_format_EPO_date = d3.time.format("%b %e, %Y");     // format date in patentNode object, e.g., Nov 1, 1978

function PatentNode(patent_no, source, biblio) {
// constructor for the data object bound to a forcePatent map node 
  this.patent_no = patent_no;
  this.source = source;                              // true if the patent is the focus of the map
  this.biblio = biblio;                              // an object containing all the bibliographic data
  this.label = makePatentLabel(patent_no);           // node labels on the force map omit the kind code
  this.key = patent_no;                              // data key for d3
  this.plotLinks = 0;                                 // number of plotted links incident on this node
  this.date = d3_format_EPO_date.parse(this.biblio.file_date);   // a javascript date
  // x_fix initialized according to the initial x-axis; x_fix never changes even if x-axis is changed
  this.x_fix = patentMapPlot.xForceScale(this.date);
  this.plotX = 0;
  this.plotY = 0;
  // note the x_fix, x,y values used in the forcePatent map are never affected by zooming; plotX,plotY is the data
  // that is actually used in the transform operations on the actual SVG elements; this.x,.y will be created and
  // defined when forcePatent map is created
  this.updatePlotCoord = function() {                           // need to call when the forcePatent map is zoomed
    this.plotX = patentMapPlot.xForceToPlotScale(this.x);
    this.plotY = patentMapPlot.yForceToPlotScale(this.y);       // translate in the y direction but do not zoom
  }
  this.drag = false;                                 // mark a node when it is being dragged
  this.sourcePatentLinks = {};             // contains link_key : patentLink key/value pairs for links to source patentNodes
  this.targetPatentLinks = {};             // contains link_key : patentLink key/value pairs for links to target patentNodes
  this.targetPatentLinksList = [];         // need to track the order that target links are added for undeleting patents
  this.biblioNode = {};                              // reference to associated BiblioNode object
  this.biblioLink = {};                              // reference to associated BiblioLink object
  this.markerRadius = 7;                             // keep track of the radius of the svg circle that is plotted
  this.sortOrder = 3;                                // sort order in DOM so pLinks, bLinks, and pNodes overlay correctly
}

function BiblioNode(patent_no, biblio) {
// constructor for the data object bound to a forceBiblio map node 
  this.patent_no = patent_no;
  this.label = makePatentLabel(patent_no);           // used for text of patent hyperlinks
  this.biblio = biblio;                              // an object containing all the bibliographic data
  this.key = patent_no;                              // data key for d3
  this.plotX = 0;
  this.plotY = 0;
  // note the x,y values used in the forceBiblio map are never affected by zooming;
  // plotX,plotY is the data that is actually used in the 'transform's on the actual SVG elements;
  // this.x,.y will be created and defined when forceBiblio map is created
  this.updatePlotCoord = function() {                          // need to call when the forceBiblio map is zoomed
    this.plotX = patentMapPlot.xForceToPlotScale(this.x);
    this.plotY = patentMapPlot.yForceToPlotScale(this.y);      // translate in the y direction but do not zoom
  }
  this.drag = false;                                 // mark a node when it is being dragged
  this.displayed = false;                            // used in updating forceBiblio map
  this.pinned = false;                               // is the biblio pinned
  this.mouseleave = false;              // needed for styling the css transition of unpinned biblio back to forcePatent node
  this.transition = false;              // needed for timing css styling changes when unpinned biblio transitions
  this.detached = false;                             // is the biblio detached from the associated node
  this.z_index = 0;                                  // css z-index
  this.patentNode = {};                              // reference to associated patentNode
  this.biblioLink = {};                              // reference to associated BiblioLink object
}

function BiblioLink(patent_no, patentNode, biblioNode) {  // the data object that is bound to bLinks between forcePatent
  this.patent_no = patent_no;                             // pNnodes and forceBiblio biblios g.pop1-markers
  this.key = patent_no;
  this.patentNode = patentNode;
  this.biblioNode = biblioNode;
  this.sortOrder = 2;                                // sort order in DOM so pLinks, bLinks, and pNodes overlay correctly
}

function PatentLink(source, target, type, key) {     // the data object that is bound as the forcePatent map pLink
  this.source = source;
  this.target = target;
  this.type = type;                                  // a string "cited", "citing", "related"
  this.key = key;                                    // data key for d3
  this.sortOrder = 1;                                // sort order in DOM so pLinks, bLinks, and pNodes overlay correctly
}

function addEPOPatentDataToForceMap(source_patent, processedList, epoQueryLists, iList) {
  // epoQueryLists is a list of objects containing keys "list" (the query list), "type" (cited, citing, related)
  // and "done" (track when the query completes); one object for each query POSTed;
  // iList is the process number that just finished; processList is a list of patents in EPO format
  // that were successfully parsed and for which biblio data exists in epoBiblio; source_patent is the
  // patent at the focus of the forcePatent diagram.
  epoQueryLists[iList]["done"] = "true";                               // the iList list has been queried and processed
  debug("In addEPOPatentDataToForceMap, retrieved biblio data for the following patents");
  debug(processedList);
  var type = epoQueryLists[iList]["type"];
  var $sourceContainer = $mappedList          // get appropriate jQuery element for source_patent in the Mapped patent list
                     .find("div.patent-list-entry[data-patent='" + source_patent + "'] div.patent-list-patent-container");
  for (var i = 0; i < processedList.length; i++) {                     // add to the forcePatent and forceBiblio maps
    var target_patent = processedList[i];
    addTargetPatentToForceMap(source_patent, target_patent, type, "new");
    addTargetPatentToMappedSublist($sourceContainer, source_patent, target_patent, type, false); 
  }
}

function addSourcePatentToForceMap(patent_no, page_type, context) {
// create a source node for patent_no on the forcePatent and forceBiblio maps; context is the context in which
// the function is called ('new', 'undo_delete', or 'undo_clear'); called from processSourcePatent and
// undeletePatent.
  if (!patentsHistory[patent_no]) {                // if not already on the forcePatent and forceBiblio maps at some point
    createForceNode(true, patent_no);              // use 'true' for a source node
  }
  else {                                           // make sure we use biblio from patentBiblio (has references lists)
    updateForceNode(true, patent_no);
  }
  // if source patent not already currently plotted as either a source patent or a target patent,
  // update data lists for force map plotting; re-plot if patent has previously been deleted
  patentLists["map"].push(patent_no);
  if (!patentsPlotted[patent_no]) {
    addPatentToPlottingLists(patent_no);            // update the data lists for force map plotting
  }
  else {                                            // node already exists as a target; change the marker to the source type
    var marker = d3.select("g.force-patent-marker[data-patent=" + patent_no + "]");
    updateMarkerOnForceMap(marker, page_type);
  }
  switch (context) {
    case "new", "undo_clear":
      updateClearedLists(patent_no, "map");
      break;
  }
}

function updateClearedLists(patent_no, list) {
// update patentLists cleared lists now that patent_no is plotted; list is 'map' or 'target'; note that patent_no can be
// mapped by clicking a map button, from the buttons at the top of the force map, or as a result of being
// undeleted; called from addSourcePatentToForceMap and addTargetPatentToForceMap.
  var cleared = patentLists["cleared"];
  // if patent_no is mapped from the buttons at the top of the force map, or if an undoClear is being executed,
  // need to check the cleared lists and delete from any in which it appears.
  var ind = cleared[list].indexOf(patent_no);
  if (ind != -1) {
    cleared[list].splice(ind, 1);
  }
  var allEmpty = true;
  for (list in cleared) {
    if (cleared[list].length > 0) {
      allEmpty = false;
    }
  }
  if (allEmpty && patentLists["clearFlag"]) {       // nothing left to un-Clear
    patentLists["clearFlag"] = false;
  }
}

function addTargetPatentToForceMap(source_patent, patent_no, type, context) {
// add patent patent_no as a target patent and create a link between source_patent and patent_no if one does
// not exist; if patent_no has not been deleted, plot the target patent if not already plotted, and plot the
// link to source patent on the forcePatent and forceBiblio maps; link 'type' is "cited", "citing", "related",
// or ""; 'context' is the context in which the function is called ('new', 'undo_delete', or 'undo_clear').
// if 'source_patent' and 'type' are passed as "", a new link is not added; source_patent and all existing links are plotted;
//
// links are only added and possibly plotted when processing
// target patents since every link is between a patent target and a patent source;
// source_patent is the patent that is currently being mapped; note that the target patent can have links to more
// than one source patent; all links to be plotted must be added to the patentLinks list of links attached to the force map
// biblio data for patent_no must exist in patentBiblio or epoBiblio.
// called from addEPOPatentDataToForceMap, undeletePatent, addFavoritePatent, and mapExistingTargetPatents,
  if (!patentsHistory[patent_no]) {                // if not already on the forcePatent and forceBiblio maps at some point
    createForceNode(false, patent_no);             // use 'false' for a target node
  }
  // if target patent not already currently plotted as either a source patent or a target patent, and if patent has not
  // already been deleted, update data lists for force map plotting
  switch (context) {
    case "new":
      if (!patentsPlotted[patent_no] && patentLists["deleted"].indexOf(patent_no) == -1) {
        addPatentToPlottingLists(patent_no);
      }
      break;
    case "undo_delete": case "undo_clear":
      if (!patentsPlotted[patent_no]) {
        addPatentToPlottingLists(patent_no);
      }
      break;
  }
  if (source_patent != "") {                       // if we have a specific source patent
  // note: patent_no might be in deleted list already; it will not be plotted, but we might still need to create
  // a link to a newly mapped source_patent; we would not plot the link in this case.
    var patentNode = patentsHistory[patent_no];
    var link_key = source_patent + patent_no + type;
    // check if need to create a link between patent_no and source_patent, and create if not already present
    if (!(link_key in patentNode.sourcePatentLinks)) {
      createForceLink(source_patent, patent_no, type, link_key);  // one of two places where links are created
    }
    if (patentsPlotted[patent_no]) {                       // plot link only if patent itself will be plotted
      var link = patentNode.sourcePatentLinks[link_key];
      addLinkToPlottingList(link);                         // this is one of two places where links are queued for plotting
    }
  }
  // re-plot links to all source patents that are on the force map (case called from undeletePatent and addFavoritePatent).
  else {
    var patentNode = patentsPlotted[patent_no];
    if (patentNode) {                                      // should always be true
      for (link_key in patentNode.sourcePatentLinks) {                   // check links from patentNode as target to
        var sourceLink = patentNode.sourcePatentLinks[link_key];         // each source patent; if source patent is plotted
        var sourcePat = sourceLink.source.patent_no;
        if (patentLists["map"].indexOf(sourcePat) != -1) {               // if source is mapped, add link to list to plot
          addLinkToPlottingList(sourceLink);       // this is one of two places where links are queued for plotting
        }
      } 
    }
  }
  switch (context) { 
    case "undo_clear":
      updateClearedLists(patent_no, "target");
      break;
  }
}

function createForceLink(source_patent, target_patent, type, link_key) {
// creates a new force link between patent_no source_patent and patent_no target_patent with the key link_key;
// called from addTargetPatentToForceMap and checkDataForPatents
  var targetNode = patentsHistory[target_patent];            // use patentsHistory instead of patentsPlotted
  var sourceNode = patentsHistory[source_patent];            // because need to create links to deleted patents also
  var link = new PatentLink(sourceNode, targetNode, type, link_key);  // the only place where new links are created
  // need ordered list of link_keys to preserve legend colors when deleting and undeleting patents
  sourceNode.targetPatentLinksList.push(link_key);
  sourceNode.targetPatentLinks[link_key] = link;             // link from sourceNode to a target patent
  targetNode.sourcePatentLinks[link_key] = link;             // link from patentNode to a source patent
}

function createForceNode(source, patent_no) {
// create PatentNode, BiblioNode, and BiblioLink data objects and push to the respective lists for the
// forcePatent and forceBiblio maps; source is a boolean specifying whether the node is a source node (true)
// or target node (false); called from addSourcePatentToForceMap and addTargetPatentToForceMap
  var biblio = (source) ? patentBiblio[patent_no] : epoBiblio[patent_no];
  var patentNode = new PatentNode(patent_no, source, biblio);               // create a new patentNode
  var biblioNode = new BiblioNode(patent_no, biblio);                       // create a new biblioNode
  var biblioLink = new BiblioLink(patent_no, patentNode, biblioNode)        // create a new biblioLink
  patentNode.biblioNode = biblioNode;                                       // each object references the other
  patentNode.biblioLink = biblioLink;
  biblioNode.patentNode = patentNode;
  biblioNode.biblioLink = biblioLink;
  patentsHistory[patent_no] = patentNode;
}

function updateForceNode(source, patent_no) {
// patent_no is assumed to exist in patentsHistory; update the biblio in patentNode and biblioNode associated with
// patent_no according to whether patent_no is a source patent
  var useBiblio = (source) ? patentBiblio[patent_no] : epoBiblio[patent_no];
  var patentNode = patentsHistory[patent_no];
  if (source) {
    // do not just substitute useBiblio for the patentNode biblio because assignee names can be different between
    // Google and EPO; it will screw up the legend if patent_no is already on it and the assignee name changes.
    patentNode.biblio.cited_patents = useBiblio.cited_patents;
    patentNode.biblio.citing_patents = useBiblio.citing_patents;
    patentNode.biblio.related_patents = useBiblio.related_patents;
    patentNode.source = source;
  }
}

function addLinkToPlottingList(link) {
// adds link to patentLinks so it will be plotted during the next updateForceMap() call
// patentLinks is the list of data for the forcePatent force map; called from addPatentToPlottingLists
// (for links that were created, deleted and now need to be replotted) and addTargetPatentToForceMap
// (for newly created links being plotted for the first time).
  patentLinks.push(link);
  link.source.plotLinks += 1;
  link.target.plotLinks += 1;
}

function addPatentToPlottingLists(patent_no) {
// called from addSourcePatentToForceMap and addTargetPatentToForceMap
  var patentNode = patentsHistory[patent_no];
  patentsPlotted[patent_no] = patentNode;                            // patent_no can only appear on one tracking list
  // delete patent_no from the other tracking lists; (does not throw an error if patent_no is not in any of them).
  delete patentsUnplotted[patent_no];
  removePatentFromDeletedList(patent_no);                            // only place where patent is removed from deleted list
  addToLegend(patentNode);                                           // add to the legend
  patentNodes.push(patentNode);                                      // add to patent node list for plotting
  biblioNodes.push(patentNode.biblioNode);                           // add to biblio node list for plotting
  biblioLinks.push(patentNode.biblioLink);                           // add to biblio link list for plotting
}

function deletePatentFromMap(patent_no, deletionType, on_delete_patent) {
// called from on_click_delete_btn and on_click_clear_btn; remove patent patent_no from the forcePatent
// and forceBiblio maps; deletionType is 'single' or 'group' (for the Clear button); on_delete_patent is
// an optional callback called after the deletion is complete
  fMap.alpha = forcePatent.alpha();
  var patentNode = d3.select("g.node[data-patent=" + patent_no + "]").datum();
  d3.select("div.bib[data-patent=" + patent_no + "] div.pop1-container")
    .classed({"make-displayed": false});

  // if patent_no is a source patent, delete target nodes first to help preserve legend colors if patent is undeleted
  if (patentNode.source) {
    // delete pLinks with patent_no as source; nextDeletions is the callback
    deleteLinksToTargetPatentsFromMap(patentNode, nextDeletions);     // nextDeletions is the callback
  }
  else {
    nextDeletions();
  }

  function nextDeletions() {
  // continue the deletion process; called from deletePatentFromMap when deleted patent is a target patent
  // and deleteTargetGroup after all target patents for a deleted source patent have been deleted
    deleteLinksToSourcePatentsFromMap(patentNode);                    // delete pLinks with patent_no as target
    deletePNode(patentNode, "delete");                                // delete patentNode from forcePatent map
    deleteBNode(patentNode.biblioNode);                               // delete associated biblioNode from forceBiblio map
    deleteBLink(patentNode.biblioNode.biblioLink);                    // delete associated biblioLink from forceBiblio map

    deletePatentFromMappedSublists(patent_no);                        // delete from any citation sublists
    removeDeleteButtonInFavoritesEntry(patent_no);                    // remove delete button option if patent in Favorites
    // keep .source property unchanged undeleting a patent will undelete it as a source patent or a reference patent
    switch (deletionType) {
      case "single":
        updateForceMap();
        if (patentNode.source) {
          forcePatent.start();                                        // let map rearrange itself significantly
        }
        else {
          forcePatent.start();
          forcePatent.alpha(Math.max(fMap.alpha, 0.06));              // let map relax somewhat
        }
        break;
      case "group":                                                   // calling function responsible for calling
        break;                                                        // updateForceMap when appropriate
    }
    if (on_delete_patent) {
      on_delete_patent();                                             // call the callback if defined
    }
  }

  function deletePatentFromMappedSublists(patent_no) {
  // utility function called from deletePatentFromMap; delete the patent from all reference sublists in the Mapped
  // list; patent has already been deleted from the Mapped list as a mapped patent in deletePNode.
    // find all entries in the Mapped list for patent_no appears as a reference; will only be in sublists at this point
    var $citationEntry = $mappedList.find("div.patent-list-patent[data-patent='" + patent_no + "']");
    var $citationContainer = $citationEntry.closest("div.patent-list-citation-container");   // select container
    var $citationListHeading = $citationContainer.find("div.patent-list-citation-heading");  // select heading in the container
    $citationListHeading.each(function() {                                                   // update patent counts
                                incrementCitationCount( $(this), "deleted", 1);
                                incrementCitationCount( $(this), "mapped", -1);});
    $citationEntry.remove();
  }

  function removeDeleteButtonInFavoritesEntry(patent_no) {
  // utility function called from deletePatentFromMap; remove delete button from entry for patent_no in the
  // Favorites list on the Map page
    $favoritesList.find("span.btn-hide-add[data-patent='" + patent_no + "']").addClass("make-not-displayed");
  }
}

function deleteLinksToSourcePatentsFromMap(targetNode) {
// targetNode is a PatentNode instance (not a d3 selection); removes all pLinks where targetNode
// is the target; does not remove the sourceNode even if targetNode is the only link to it
  for (linkKey in targetNode.sourcePatentLinks) {
    var sourceLink = targetNode.sourcePatentLinks[linkKey];  // sourceLink is the link from patentNode as target
    var sourceNode = sourceLink.source;                      // to sourceNode as source
    if (patentLists["map"].indexOf(sourceNode.patent_no) != -1) {  // if source patent is plotted
      deletePLink(sourceLink);
      if (sourceNode.plotLinks == 0) {            // if sourceNode is now disconnected, let the source node stay on the map
//              deletePNode(sourceNode);                             // delete patentNode from forcePatent map
//              deleteBNode(sourceNode.biblioNode);                  // delete associated biblioNode from forceBiblio map
//              deleteBLink(sourceNode.biblioLink);                  // delete associated biblioLink from forceBiblio map
      }
    }
  }
}

function deleteLinksToTargetPatentsFromMap(sourceNode, nextDeletions) {
// sourceNode is a PatentNode instance (not a d3 selection); removes all pLinks where sourceNode
// is the source patent; removes the targetNode patent if sourceNode is the only link to it and it is
// not also a source patent; if called from deletePatentFromMap (user clicks delete button), nextDeletions
// is a callback to continue the deleting process after timeout to allow the force map to relax; if called
// from removePatentFromMapped (user clicks unmap button), nextDeletions is null.
  var linksList = sourceNode.targetPatentLinksList;
  if (linksList.length == 0) return;
  var nL = 40;                                         // delete nL links and associated patents at a time
  var groupList = createGroupList(linksList, nL);      // break into list of subgroups of indices in linksList
  // delete target patents one group at a time, so map updates during Delete and Clear of large groups of patents
  // delete linked patents in reverse order to help preserve legend colors if a source patent is undeleted
  var iL = groupList.length - 1;
  if (iL >= 0) {
    taskTracker.initialize("Deleting", undefined);
    taskTracker.startTask(groupList.length);
    deleteTargetGroup();
  }
  else {
    if (nextDeletions) {                               // if deleting a patent, not just unmapping it
      nextDeletions();
    }
  }

  function deleteTargetGroup() {
  // delete the iL'th group of links and asociated patents in linksList
    if (arguments.length > 0) {                       // was called recursively after timeout in this function
      taskTracker.finishTask(arguments[0]);
    }
    var index = groupList[iL];
    // delete in reverse order to help preserve legend colors if use undoes the delete
    for (var jL = index.end - 1; jL >= index.start; jL--) {
      var linkKey = linksList[jL];
      deleteTargetPatentFromMap(sourceNode, linkKey);
    }
    updateForceMap();
    if (iL > 0) {
      iL--;
      // call deleteTargetGroup again after allowing 1 task to finish
      window.setTimeout(deleteTargetGroup.bind(undefined, 1), 500);
    }
    else {
      window.setTimeout(afterFinalGroup, 500);
    }
  }

  function afterFinalGroup() {
    taskTracker.finishTask(1);
    if (nextDeletions) {
      nextDeletions();
    }
  }
}

function deleteTargetPatentFromMap(sourceNode, linkKey) {
// delete the target patent associated with linkKey; sourceNode is a PatentNode instance (not a d3 selection);
// called from deleteLinksToTargetPatentsFromMap
  var targetLink = sourceNode.targetPatentLinks[linkKey];  // targetLink is the link from patentNode as source
  var targetNode = targetLink.target;                      // to targetNode as target
  if (targetNode.patent_no in patentsPlotted) {
    deletePLink(targetLink);
    if (targetNode.plotLinks == 0 && !targetNode.source) {   // if targetNode is now disconnected, unplot the targetNode
      deletePNode(targetNode, "unplot");                     // delete patentNode from forcePatent map
      deleteBNode(targetNode.biblioNode);                    // delete associated biblioNode from forceBiblio map
      deleteBLink(targetNode.biblioLink);                    // delete associated biblioLink from forceBiblio map
    }
  }
}

function deletePLink(patentLink) {
// delete patentLink (of type PatentLink) from the forcePatent map; but do not delete the patentLink itself;
  var linkKey = patentLink.key;
  var index = patentLinks.indexOf(patentLink);
  if (index != -1) {
    patentLinks.splice(index, 1);                                     // remove 1 patentLink from patentLinks at the index
    // note we do not delete the linkKey entry in the targetPatentLinksList, targetPatentLinks, or sourcePatentLinks
    // objects of the source and target patentNodes because we need to keep a record of the patents that are linked
    // together in case a patent is un-deleted and we want to replot all the associated links;  need to call updateForceMap
    // to actually remove the SVG elements associated with patentLink
    patentLink.source.plotLinks -= 1;                                 // update link counts for the sourceNode and targetNode
    patentLink.target.plotLinks -= 1;
  }
  else {
    debug("In deletePLink, tried to delete patentLink that was not on the force map: ", patentLink);
  }
}

function deleteBNode(biblioNode) {
// delete biblioNode from the forceBiblio map by deleting it from the biblioNodes list, but do not delete
// biblioNode itself; need to call updateForceMap to actually remove the SVG elements associated with biblioNode
  var patent_no = biblioNode.patent_no;
  var index = biblioNodes.indexOf(biblioNode);
  if (index != -1) {
    biblioNodes.splice(index, 1);                                       // remove 1 biblioNode from biblioNodes at the index
  }
  else {
    debug("In deleteBNode, tried to delete biblioNode that was not on the force map: ", biblioNode);
  }
}

function deleteBLink(biblioLink) {
// delete biblioLink from the map by deleting it from the biblioLinks list, but do not delete
// biblioLink itself; need to call updateForceMap to actually remove the SVG elements associated with biblioLink
  var patent_no = biblioLink.patent_no;
  var index = biblioLinks.indexOf(biblioLink);
  if (index != -1) {
    biblioLinks.splice(index, 1);                                       // remove the entry for the link from biblioLinks
  }
  else {
    debug("In deleteBLink, tried to delete biblioLink that was not on the force map: ", biblioLink);
  }
}

function deletePNode(patentNode, deletionType) {
// remove patentNode (of type PatentNode) from the forcePatent map by deleting it from the patentNodes
// list, but do not delete the patentNode itself; if deleted patent is a source patent, delete it from the
// patentLists["map"] list and unclick all the associated map buttons; update the patentsUnplotted or deleted
// lists according to deletionType: if "unplot", the patentNode is being removed as part of unmapping a source patent;
// or if "delete", the user clicked the delete button for a patent on the force map; need to call updateForceMap
// to actually delete the SVG elements associated with the patentNode; called from deletePatentFromMap
// and deleteLinksToTargetPatentsFromMap
	var patent_no = patentNode.patent_no;
  var index = patentNodes.indexOf(patentNode);
  if (index != -1) {
    patentNodes.splice(index, 1);                                     // remove 1 patentNode from patentNodes at the index
    delete patentsPlotted[patent_no];                                 // remove the entry for the patent from patentsPlotted
    switch (deletionType) {
      case "unplot":
        patentsUnplotted[patent_no] = patentNode;
        break;
      case "delete":
        addPatentToDeletedList(patent_no);                            // only place where patent_no is added to deleted list
        break;
    }
    if (patentNode.source) {                                          // if a sourceNode
      // get jQuery map button associated with this patent on forcePatent map to pass to toggleBtn
      var $mapBtn = $("div.bib[data-patent='" + patent_no + "']").find("span.btn-map-add");
      updatePatentListTrackers("map", $mappedList, patent_no, $mapBtn);
    }
    deleteFromLegend(patentNode);
  }
  else {
    debug("In deletePNode, tried to delete patentNode that was not on the force map: ", patentNode);
  }
}

function undeletePatent(patent_no, deletionType, context, on_undelete_complete) {
// undelete deleted patent patent_no; call the callback function on_undelete_complete when done; 'context' is the
// context in which the function is called ('undo_delete' or 'undo_clear'); called from
// on_click_undo_delete_btn, and restoreClearedPatents
  var patentNode = patentsHistory[patent_no];
  if (patentNode.source) {
    addSourcePatentToForceMap(patent_no, "map", context);   // also maintains deleted list
    addSourcePatentToMappedList(patent_no);                 // re-create entry in Mapped list on the Map page
    // undelete the reference patents associated with patent_no;
    mapExistingTargetPatents(patent_no, on_map_complete);   // on_map_complete is the callback
  }
  else {
    addTargetPatentToForceMap("", patent_no, "", context);    // recreate patent_no and all links to it on force map
    on_map_complete();
  }

  function on_map_complete() {
  // complete task of undeleting a patent called from undeletePatent when undeleting a target patent or
  // mapExistingTargetPatents after timeout when undeleting a source patent
    updateMapFavButtons(patent_no);
    remakeDeletedCitationListEntries(patent_no, patentNode);
    switch (deletionType) {
      case "single":
        updateForceMap();
        break;
      case "group":
        break;            // functions specifying 'group' undeletes are responsible for calling updateForceMap themselves
    }
    if (patent_no in patentLists["favorites"]) {     // show delete button in Favorites list entry
      var $patentContainer = $favoritesList
                           .find("div.patent-list-entry[data-patent='" + patent_no + "'] div.patent-list-patent-container");
      setupDeleteButton($patentContainer, patent_no);
    }
    if (on_undelete_complete) {                      // call the callback if it was passed
      on_undelete_complete();
    }
  }

  function updateMapFavButtons(patent_no) {
  // need to set state of Map and Favorite buttons on patent, search, and related tabs; button state for biblios on the
  // force map are set when updateForceMap is called; button state in the Mapped and Favorites lists on the Map page are
  // set when patent_no is added to the list
    if (patentLists["map"].indexOf(patent_no) != -1) {
      toggleButton(patent_no, "btn-map-add", "add");
    }
    if (patentLists["favorites"].indexOf(patent_no) != -1) {
      toggleButton(patent_no, "btn-favorite-add", "add");
    }
  }
}

function mapExistingTargetPatents(source_patent, on_map_complete) {
// plot reference patents for which epoBiblio data has already been queried and processed
  var sourceNode = patentsPlotted[source_patent];       // source_patent must already be plotted on the force map
  var $sourceContainer = $mappedList       // get appropriate jQuery element for source_patent in Mapped patent list
                 .find("div.patent-list-entry[data-patent='" + source_patent + "'] div.patent-list-patent-container");
  var linksList = sourceNode.targetPatentLinksList;
  var nL = 40;                                          // replot nL links and associated patents at a time
  var groupList = createGroupList(linksList, nL);       // break into list of subgroups of indices in linksList
  // plot target patents one group at a time, so map updates when undeleting a source patent with lots of references
  if (groupList.length > 0) {
    var iL = 0;
    taskTracker.initialize("Fetching", undefined);
    taskTracker.startTask(groupList.length);
    plotTargetGroup();
  }
  else {
    on_existing_map_complete();
  }

  function plotTargetGroup() {
  // plot the iL'th group of links and associated patents in linksList
    if (arguments.length > 0) {                         // was called recursively after timeout in this function
      taskTracker.finishTask(arguments[0]);
    }
    var targetPatentsList = [];
    var index = groupList[iL];
    // map in the same order that links were originally mapped
    for (var jL = index.start; jL < index.end; jL++) {
      var link = linksList[jL];                           // to help preserve legend colors
      var linkToTargetPatent = sourceNode.targetPatentLinks[link];
      var target_patent = linkToTargetPatent.target.patent_no;
      var type = linkToTargetPatent.type;
      addTargetPatentToForceMap(source_patent, target_patent, type, "new");
      addTargetPatentToMappedSublist($sourceContainer, source_patent, target_patent, type, false);
      targetPatentsList.push(target_patent);
    }
    updateForceMap();
    debug("In mapExistingTargetPatents, for source patent " + source_patent + ", already have EPO data for "
              + targetPatentsList.length + " reference patents: ", targetPatentsList);
    iL++;
    if (iL < groupList.length) {
      // call plotTargetGroup again after allowing 1 task to finish
      window.setTimeout(plotTargetGroup.bind(undefined, 1), 500);
    }
    else {
      window.setTimeout(afterFinalGroupPlotted, 500);    // after final group plotted
    }
  }

  function afterFinalGroupPlotted() {
    taskTracker.finishTask(1);
    on_existing_map_complete();
  }

  function on_existing_map_complete() {
    if (on_map_complete) {
      on_map_complete();                                 // call the callback function
    }
  }
}

function remakeDeletedCitationListEntries(patent_no, patentNode) {
// create reference sublist entries in the Mapped patent list for patent_no under all source patents it is linked
// to that are on the Mapped list; called from on_click_undo_delete and addFavorite patent
  for (link in patentNode.sourcePatentLinks) {
    var linkToSourcePatent = patentNode.sourcePatentLinks[link];
    var source_patent = linkToSourcePatent.source.patent_no;
    if (patentLists["map"].indexOf(source_patent) != -1) {         // if source_patent is currently mapped
      var type = linkToSourcePatent.type;
      var $sourceContainer = $mappedList     // get appropriate jQuery element for source_patent in Mapped patent list
                 .find("div.patent-list-entry[data-patent='" + source_patent + "'] div.patent-list-patent-container");
      addTargetPatentToMappedSublist($sourceContainer, source_patent, patent_no, type, true);
    }
  }
}

function createGroupList(list, nL) {
// takes a list and returns a list of groupList objects {start: startIndex, end: endIndex} so that list can
// processed in groups approximately nL in size
  var groupList = [];
  if (list.length > 0) {
    var kL = Math.ceil(list.length/nL)              // number of subgroups
    nnL = Math.floor(list.length/kL);               // make the groups about the same size
    for (var iL = 0; iL < kL - 1; iL++) {
      groupList.push({start: iL*nnL, end: (iL + 1)*nnL});
    }
    groupList.push({start: (kL - 1)*nnL, end: list.length});
  }
  return groupList;
}

function makeGoogleDate(dateStr) {
// use moment.js to take a string like 20100416 and return a string Apr 16, 2010 (Google format).
  return moment.utc(dateStr, "YYYYMMDD").format("MMM D, YYYY");
};

function makeGoogleName(nameStr) {
// take an EPO biblio inventor or applicant name (all caps SMITH PAUL L [US]) or MONSANTO LLC [US]) and strip off
// the [US] and return mixed upper/lower case (Google format) names.
  var s = nameStr.replace(/\s\[\w*\]/g, "");                     // remove [US] from the end of the applicant name
  return makeUpperLower(s);                                      // make mixed upper/lower case
}

function makeUpperLower(nameStr) {
// return mixed upper/lower case (Google format) names; in the regex, \b matches a word boundary; \w matches any
// alphanumeric character; \s matches any whitespace character, including tabs and special unicode space characters
// that are sometimes present in the EPO biblio data; occasionally, even Google has names in full caps.
  return nameStr.toLowerCase().replace(/\b\w/g, function(match) {return match.toUpperCase();});
}


function makeShort(assignee) {
// take an assignee name and make a shortened version of it for the purpose of creating the shortAssignee
// property of biblio objects, which is used in creating legend entries; called from getTIA and parseEPOPatentData
  var coList = ["INC", "INCORP", "LLC", "LIMITE", "LTD", "CO", "COMPAN", "TECHNO",
                "TECH", "INDUST", "IND", "NV"];
  switch (assignee.slice(0,4).toUpperCase()) {
    case "":                                          // some patents have no assignee
      return "No assignee";
    case "UNIV":
      switch (assignee.slice(0,10).toUpperCase()) {
        case "UNIVERSITY":
          return assignee.slice(0,20);
        default:
          return assignee.slice(0,12);
      }
    default:
      var wordList = assignee.split(/[,\s]+/);    // split into list of words
      if (wordList.length == 1) {
        return wordList[0].slice(0,7);          // use first seven letters of first word as basis of matching an assignee name
      }
      else {
        var word2 = wordList[1].slice(0,6).toUpperCase();
        if (coList.indexOf(word2) == -1) {        // 2nd word is not in coList
          return wordList[0].slice(0,7) + " " + wordList[1].slice(0,7);
        }
        else {
          return wordList[0].slice(0,7);        // use first seven letters of first word as basis of matching an assignee name
        }
      }
  }
}

function getTIA($context) {
  // get title, inventor(s), and assignee(s) in a patent document $context; used when setting up a patent tab and in the
  // a patent entry in the patentBiblio object list; called from processPatentPage and tabPopoverManager.setupPatentTab.
  var title = $("span.patent-title", $context).text();
  debug("In getTIA, got title " + (new Date() - startTime)/1000);
  var inventorList = [];
  var assigneeList = [];
  var shortAssigneeList = [];
  $("table.patent-bibdata td.patent-bibdata-heading:contains('Inventors') + td span.patent-bibdata-value a", $context)
      .each(function() {
              var inventor = $(this).text();
              inventor = makeUpperLower(inventor);              // correct occasional all uppercase inventor name
              inventorList.push(inventor);
            });
  debug("In getTIA, got inventors " + (new Date() - startTime)/1000);
  $("table.patent-bibdata td.patent-bibdata-heading:contains('Assignee') + td span.patent-bibdata-value a", $context)
      .each(function() {
              var assignee = $(this).text();
              assignee = makeUpperLower(assignee);              // occasionally name is all uppercase(?)
              var finalAssignee = assignee.replace(/S A$|Sa$/, "SA").replace(/Llc/, "LLC").replace(/A G$|Ag$/, "AG")
                                          .replace(/G M B H$|Gmbh$/, "GmbH");
              assigneeList.push(finalAssignee);
              shortAssigneeList.push(makeShort(finalAssignee))
            });
  if (assigneeList.length == 0) {                               // Assignee or Applicant, depending on which country
    $("table.patent-bibdata td.patent-bibdata-heading:contains('Applicant') + td span.patent-bibdata-value a", $context)
      .each(function() {
              var assignee = $(this).text();
              var finalAssignee = assignee.replace(/S A$|Sa$/, "SA").replace(/Llc/, "LLC").replace(/A G$|Ag$/, "AG")
                                          .replace(/G M B H$|Gmbh$/, "GmbH");
              assigneeList.push(finalAssignee);
              shortAssigneeList.push(makeShort(finalAssignee))
            });
  }
  var inventors = inventorList.join(", ");
  var assignees = assigneeList.join(", ");
  var shortAssignees = shortAssigneeList.sort().join(" ");
  debug("In getTIA, got assignee " + (new Date() - startTime)/1000);
  return {title: title, inventors: inventors, assignee: assignees, shortAssignee: shortAssignees};
}

function TaskTracker() {
  this.initialize = function(taskType, callback) {
    // if final timeout still running from previous query set
    if (this.runningTimeout && (this.maxCount == this.doneCount)) {
      window.clearTimeout(this.runningTimeout);
      this.tasksComplete();
    }
    $("span.status-line-type").text(taskType + " ");
    this.doneCount = 0;
    this.maxCount = 0;
    this.runningTimeout = undefined;
    this.callback = callback;
  }
  this.startTask = function(num) {
    this.maxCount += num;
    this.updateMessage();
    if (!this.runningTimeout) {    // if no query was running, then need to make the status message visible
      $("div.status-line").addClass("make-visible");
    }
    this.updateTimeout();
  }
  this.finishTask = function(num) {
    this.doneCount += num;
    this.updateMessage();
    this.updateTimeout(); 
  }
  this.updateTimeout = function() {
    if (this.runningTimeout) {
      window.clearTimeout(this.runningTimeout);
    }
    if (this.maxCount > this.doneCount) {                          // at least one query is still running
      var newTime = (this.maxCount - this.doneCount)*2000;
    }
    else {                                                         // all queries in queue have completed
      var newTime = 2000;
    }
    this.runningTimeout = window.setTimeout(this.tasksComplete.bind(this), newTime);
  }
  this.tasksComplete = function() {
    $("div.status-line").removeClass("make-visible");
    this.runningTimeout = undefined;
    if (this.doneCount != this.maxCount) {
      debug("In TaskTracker, " + (this.maxCount - this.doneCount) + " tasks failed to complete");
    }
    if (this.callback) {               // call the callback passed in .initialize if it is defined
      this.callback();
    }
  }
  this.updateMessage = function() {
    $("span.status-line-queries").text(this.report());
  }
  this.report = function() {
    return this.doneCount + "/" + this.maxCount;
  }
}
