// javascript for the map and favorite buttons, together with the functions that are called when these buttons are
// clicked

      function setupMapFavButtons($btnContext, $docContext, page_type, patent_no) {
        var btnMap = $("span.btn-map-add", $btnContext);
        var btnFav = $("span.btn-favorite-add", $btnContext);
        $("span.btn-map-add, span.btn-favorite-add", $btnContext)
                 .attr("data-patent", patent_no)
                 .on("click", {$context: $docContext, page: page_type}, on_click_map_buttons);
        if (patentLists["map"].indexOf(patent_no) != -1) btnMap.addClass("show-result-btn");
        if (patentLists["favorites"].indexOf(patent_no) != -1) btnFav.addClass("show-result-btn");
      }


      function on_click_map_buttons(event) {
      // click event handler for the 'map' and 'favorite' buttons
      // event.data stores the jQuery context of the element that generated the event in .$context, and the type
      // of page the button in .page on a patent page, $context is the main html document;
      // on the search results and related patents pages, $context is the document in the iframe
        event.preventDefault();
        event.stopPropagation();
        var $context = event.data.$context;
        var page_type = event.data.page;                    // button was clicked on page type page_type
        var pressedButton = $(event.target, $context);
        var patent_info = getPatentURL_No(event.currentTarget, event.data.$context, page_type);
        var patent_no = patent_info.patent_no;
        var patList = pressedButton.hasClass("btn-map-add") ?
                                                        "map": (pressedButton.hasClass("btn-favorite-add") ? "favorites": "");
        if (pressedButton.hasClass("show-result-btn")) {    // remove patent
          switch (patList) {
            case "favorites":
              removePatentFromFavorites(patent_no, pressedButton, page_type);
              break;
            case "map":
              removePatentFromMapped(patent_no, pressedButton, page_type);
              break;
          }
          debug("In on_click_map_buttons, removing patent " + patent_no + " from " + patList + " list");
        }
        else {                                              // add patent
          toggleBtn(patent_no, pressedButton, "add");       // toggle appearance of button
          debug("In on_click_map_buttons, adding patent " + patent_no + " to " + patList + " list");
          switch (patList) {
            case "favorites":
              addFavoritePatent(patent_no, page_type);
              break;
            case "map":
              addMapPatent(patent_no, page_type, on_mapping_complete);
              break;
          }
        }

        function on_mapping_complete() {
          // expect last action is to enable Clear button, but call with no argument so button state is determined
          // by whether patentsPlotted contains any patents
          debug("In on_mapping_complete, patentsPlotted: ", patentsPlotted);
          setUndoButtonState();
          setClearButtonState();
        }
      }

      function toggleBtn(patent_no, btn, action) {
      // toggle the state of the map or favorite button for patent patent_no according to the action ("add" or "remove");
      // btn is the jQuery object for the map or add button that was clicked; called from on_click_map_buttons.
        var btn_type = btn.hasClass("btn-map-add") ? "btn-map-add": (btn.hasClass("btn-favorite-add") ? "btn-favorite-add": "");
        toggleButton(patent_no, btn_type, action);
      }

      function toggleButton(patent_no, btn_type, action) {
      // called from toggleBtn when user clicks on an add to map or favorite button; called from PatentPicker and
      // and RandomPatentPicker objects when patents are mapped via the Go!, Random, and Fun buttons.
        // get the map or favorite button on the force map
        var $forceMapBtns = $("div#Map span."+btn_type+"[data-patent='"+patent_no+"']", document);
        if ($forceMapBtns.length > 0) changeClass($forceMapBtns, action);          // update whether it displays as clicked or not
        // get the map or favorite button on the patent tab for patent_no
        var $patTabBtns = $("ul.nav-tabs span."+btn_type+"[data-patent='"+patent_no+"']", document);
        if ($patTabBtns.length > 0) changeClass($patTabBtns, action);              // update whether it displays as clicked or not
        $("div.tab-pane[id^='result'] iframe, div.tab-pane[id^='related'] iframe") // get all iframes for search and related tabs
          .each(function() {                                         // in each one, search for buttons associated with patent_no
            $context = $(this).contents();
            var $btn_family = $("span."+btn_type+"[data-patent='"+patent_no+"']", $context);
            if ($btn_family.length > 0) changeClass($btn_family, action);          // update how button for patent_no is displayed
          });
        function changeClass($btns, action) {
          switch (action) {
            case "remove":
              $btns.removeClass("show-result-btn");
              break;
            case "add":
              $btns.addClass("show-result-btn");
              break;
            default:
          }
        }          
      }

      function addFavoritePatent(patent_no, page_type) {
      // add patent_no to the favorites list; page_type provide context for page where favorites button was clicked.
      // called from on_click_map_buttons
        if (!(patent_no in favoriteBiblio)) {
          debug("In addFavoritePatent, do not have " + patent_no + " in favoriteBiblio");
          getFavoriteBiblioData(patent_no, plotFavoritePatent);   // addFavoritePatent is the callback
        }
        else {
          debug("In addFavoritePatent, have " + patent_no + " in favoriteBiblio");
          plotFavoritePatent();
        }

        function getFavoriteBiblioData(patent_no, on_favorite_biblio_complete) {
        // create an entry in favoriteBiblio for patent_no; check patentBiblio and epoBiblio first; then query Google
        // related patent if necessary; callback on_favorite_biblio_complete when done; called from on_click_map_buttons.
          favoriteBiblio[patent_no] = {}              // favoriteBiblio does not have citation or related patent lists
          var existingBiblio = (patentBiblio[patent_no]) ? patentBiblio[patent_no] : epoBiblio[patent_no];
          if (existingBiblio) {
            favoriteBiblio[patent_no]["title"] = existingBiblio["title"];
            favoriteBiblio[patent_no]["file_date"] = existingBiblio["file_date"];
            favoriteBiblio[patent_no]["pub_date"] = existingBiblio["pub_date"];
            favoriteBiblio[patent_no]["inventors"] = existingBiblio["inventors"];
            favoriteBiblio[patent_no]["assignee"] = existingBiblio["assignee"];
            on_favorite_biblio_complete();
          }
          else {                                      // need to run a query on Google /patents/related
            taskTracker.initialize("Fetching", undefined);
            taskTracker.startTask(1);
            getQuickBiblioData(patent_no, on_quick_favorite_biblio_data);  // on_quick_favorite_biblio_data is the callback
          }

          function on_quick_favorite_biblio_data(data) {
          // extract the biblio information from the data returned by the metadata query; for Favorites List
            favoriteBiblio[patent_no]["title"] = (data[1]) ? data[1] : "Title not available";
            // dates come back as a list of integers [year, month, day]; need to convert to "YYYYMMDD" format for makeGoogleDate
            var pub_date =                                         // only issued US patents have data for the published date
                    (data[7]) ? makeGoogleDate(data[7][0] + ("0" + data[7][1]).slice(-2) + ("0" + data[7][2]).slice(-2)) : "N/A";
            favoriteBiblio[patent_no]["pub_date"] = pub_date;
            favoriteBiblio[patent_no]["file_date"] =               // early US patents do not have a file data; use pub_date instead
                    (data[6]) ? makeGoogleDate(data[6][0] + ("0" + data[6][1]).slice(-2) + ("0" + data[6][2]).slice(-2)) : 
                    ((data[7]) ? pub_date : "");
            var inventorList = data[11].join(", ");
            var assigneeList = data[12].join(", ");
            favoriteBiblio[patent_no]["inventors"] = (inventorList == "") ? "Inventors not available" : inventorList;
            favoriteBiblio[patent_no]["assignee"] = (assigneeList == "") ? "Assignee not available" : assigneeList;
            on_favorite_data_complete();
          }

          function on_favorite_data_complete() {
          // update the favorites list on the Map tab; called from on_quick_favorite_biblio_data.
            taskTracker.finishTask(1);
            debug("In getFavoriteBiblioData, for " + patent_no + ", got favorite biblio data: ", favoriteBiblio[patent_no]);
            on_favorite_biblio_complete();
          }
        }

        function plotFavoritePatent() {
        // execute all steps necessary to add a patent to the Favorites list on the Map page; favoritesBiblio must already
        // have an entry for patent_no; patent_no is in the scope of the containing function; called from
        // addFavoritePatent, either directly or as callback for getFavoriteBiblioData.
          patentLists["favorites"].push(patent_no);               // add to "favorite" list
          var patentNode = (patentsHistory[patent_no] && !patentsPlotted[patent_no]) ? patentsHistory[patent_no]: {};
          if (patentNode) {                                       // patent was plotted, but then unplotted or deleted
            for (link in patentNode.sourcePatentLinks) {
              var linkToSourcePatent = patentNode.sourcePatentLinks[link];
              var source_patent = linkToSourcePatent.source.patent_no;
              if (patentLists["map"].indexOf(source_patent) != -1) {     // if any source_patent is currently mapped and
                if (patentLists["deleted"].indexOf(patent_no) != -1) {   // if patent_no was deleted as some point, then replot
                  // could have been deleted as a mapped patent, but always re-plot a Favorite patent as a target patent
                  patentNode.source = false;
                  // recreate patent_no and links to plotted source patents on force map
                  addTargetPatentToForceMap("", patent_no, "", "undo_delete");
                  setUndoBUttonState();
                  break;
                }
              }
            }
            remakeDeletedCitationListEntries(patent_no, patentNode);
          }
          if (patentsPlotted[patent_no]) {              // if the patent is on the force map
            var marker = d3.select("g.force-patent-marker[data-patent=" + patent_no + "]");
            updateMarkerOnForceMap(marker, page_type);
          }
          addFavoritePatentToFavoritesList(patent_no);  // add entry in Favorites list (takes care of showing delete button)
        }

        function addFavoritePatentToFavoritesList(patent_no) {
        // create an entry for patent_no in the Favorites patents list on the Mapped page; uses global variables
        // $favoritesList and favoriteBiblio
          var patentObj = favoriteBiblio[patent_no];
          var patentEntryHTML = compiledFavoritesListEntryTemplate({"patent_no": patent_no});
          $favoritesList.find("div.patent-list-patents").prepend(patentEntryHTML);   // add to beginning of list
          var $patentContainer = $favoritesList
                                 .find("div.patent-list-entry[data-patent='" + patent_no + "'] div.patent-list-patent-container");
          var patentSectionHTML = compiledPatentListBiblioTemplate(
                                  {"patent_no": patent_no, "patent_label": makePatentLabel(patent_no),"source_patent": patent_no,
                                   "title": patentObj["title"], "file_date": patentObj["file_date"]});
          $patentContainer.append(patentSectionHTML);
          // add event handlers for Map and Fav buttons
          setupMapFavButtons($patentContainer, document, "favorites-list", patent_no);
          setupDeleteButton($patentContainer, patent_no);
          setupPatentLink($patentContainer, "favorites-list");
          setupPatentHighlight($patentContainer, patent_no, "favorites-list");
          setupPatentFullView($patentContainer, patent_no, "favorites-list");
        }
      }

      function getQuickBiblioData(patent_no, on_complete_quick_metadata_post) {
      // called from getFavoriteBiblioData when do not have biblio data for a patent added to Favorites list
      // and from randomPatentPicker.tryRandomPatent when looking for a random patent;
      // get bibliographic data for patent_no for use in the favorites list or as a random patent using the Google
      // related art service goal is to get the data quickly, so do not get citing patent list, which requires
      // loading and parsing the full patent; on_complete_quick_metadata_post is the callback called when the POST
      // request returns with the data as the argument.
      // POST requests to /patents/related/rpc are a very convenient way to get the bibliographic info!!
      // Use chrome extension 'Postman' to debug the POST query
      // Get the metadata (info in the panel on the right side of a related patents page.
        $.cookie("yappee_cl", clientCookie);                      // set clientCookie
        $.ajax({ type: "POST",
                 url: "/patents/related/rpc",
                 headers: {"XmlHttpRequest": "2"},
                 contentType: "application/x-www-form-urlencoded; charset=UTF-8",    // this is default
                 data: {"m": "metadata",
                        "id": patent_no},
                 success: on_complete_quick_metadata_post,
                 dataType: "json"
               });
        $.removeCookie("yappee_cl");                              // remove clientCookie
      }

      function addMapPatent(patent_no, page_type, on_mapping_complete) {
      // query biblio data for patent_no as the source patent and all the citing, citing, and related patents; page_type
      // indicates the context in which addMapPatent was called (either from the map or a patent list); add source and
      // target patents to force map; call the callback on_mapping_complete when done.
        if (patentLists["map"].indexOf(patent_no) == -1) {       // if patent not already mapped
          $("a[href='#Map']").click();                           // switch to the Map tab
          // if this is a new force map; clear out any previously Cleared patents; use underscore.js utility function
          if (_.isEmpty(patentsPlotted) && patentLists["deleted"].length == 0) {
            patentMapPlot.initialize();         // reset force map pParam, date default date scale, set mouse mode to 'normal', etc.
            initializeClearedLists();
            initializeDeletedList();
          }
          startTime = new Date();
          debug("In addMapPatent, started mapping process");
          if (!(patent_no in patentBiblio)) {                    // if no bibliographic info
            debug("In addMapPatent, do not have " + patent_no + " in patentBiblio");
            taskTracker.initialize("Fetching", undefined);
            patentBiblio[patent_no] = {};                        // create empty entry in patentBiblio for patent_no
            // to track status of the queries for patent data; used by callback on_patent_data_complete
            var status = {bibDone: false, relDone: false, expired: false};
            // get bibliographic info for the patent from the google patent page
            taskTracker.startTask(2);                            // start two queries
            var patentDocHTML = getPatentDocHTML(patent_no);
            if (patentDocHTML) {
              processPatentPage(patentDocHTML);
            }
            else {
              getGooglePatentHTML(patent_no, processPatentPage); // processPatentPage is the callback
            }
            // get the patents related to this one from a customized google related patents search
            getRelatedPatentList();                              // on_patent_data_complete is the callback
            var patentDataTimeout = setTimeout(function() {
                                                 status.expired = true;
                                                 on_patent_data_complete();
                                               }, 20000);    // 20 seconds
          }
          else {
            debug("In addMapPatent, have " + patent_no + " in patentBiblio");
            // there is already an entry for patent_no in patentBiblio, so proceed with the mapping process
            mapSourcePatent();
          }
        }
        else {
          if (on_mapping_complete) {
            on_mapping_complete();
          }
        }

        function getGooglePatentHTML(patent_no, on_get_google_patent) {
        // use jQuery to make GET request from Google for the patent page for patent_no; call callback on_get_google_patent
        // when done.
          debug("In getGooglePatentHTML, request data from Google for " + patent_no);
          var patent_url = "/patents/" + patent_no;
          $.cookie("yappee_cl", clientCookie);                      // set clientCookie, removed in on_patent_data_complete
          $.get(patent_url, on_get_google_patent);
        }

        function getPatentDocHTML(patent_no) {
        // called from on_click_map_buttons; return the HTML document for patent patent_no (central patent on the
        // forcePatent map) if a tab for it already exists; otherwise return nothing.
          var $aTab = $("a[data-tabname='" + patent_no + "']");             // if patent tab for this patent already
          if ($aTab.length > 0) {                                           // exists return the HTML document
            var div_id = $aTab.attr("href");
            debug("In getPatentDocHTML, tab for patent " + patent_no + " is already open");
            return $("div" + div_id + " > iframe").contents();
          }
          return undefined;                                                 // do not have tab for this patent
        }

        function on_patent_data_complete() {
        // callback for processPatentPage and getRelatedPatentList; patentBiblio now has a complete entry for patent_no
        // (unless queries took too much time); status is in scope of containing function on_click_map_buttons; it is
        // an object containing the status of each callback.
          debug("In on_patent_data_complete: getting data for patent " + patent_no + ".  Status: ", status);
          if (!status["expired"]) {
            taskTracker.finishTask(1);
            if (status["bibDone"] && status["relDone"]) {
              debug("In on_patent_data_complete, added entry for " + patent_no + " to patentBibio");
              clearTimeout(patentDataTimeout);
              window.setTimeout(function() {$.removeCookie("yappee_cl");}, 1000);
              window.setTimeout(mapSourcePatent, 500);  // short delay to allow status update
            }
          }
          else {
            $.removeCookie("yappee_cl");
            debug("Too much time waiting for data in on_patent_data_complete.  Status: ", status);
          }
        }

        function mapSourcePatent() {
        // called from on_patent_data_complete and on_click_map_buttons; finish mapping the source patent (patent
        // whose 'map' button was clicked; then continue with steps to map the patents referenced to the source patent
          debug("In mapSourcePatent, patentLists: ", patentLists, "; patentBiblio: ", patentBiblio);
          debug("In mapSourcePatent, starting to assemble data for mapping at " + (new Date() - startTime)/1000);
          processSourcePatent();
          mapReferencePatents();
        }

        function processSourcePatent() {
        // called from mapSourcePatent.
            addSourcePatentToForceMap(patent_no, page_type, "new");         // page_type in scope of addMapPatent
            addSourcePatentToMappedList(patent_no);
            debug("In processSourcePatent, adding the source node for " + patent_no + " to the force map");
            updateForceMap();                        // add the source patent to the forcePatent and forceBiblio maps
        }

        function mapReferencePatents() {
        // called from mapSourcePatent; create lists of cited, citing, and related patents; query the EPO database to
        // get the biblio data; process the data; and map the patents
          // checkDataForPatents checks if we already have biblio data and a link in the patentNode for patent_no for
          // each reference patent in the list; if so, we are set to map the reference; if not, we add a link if needed or
          // or add to a list of patents we need to query biblio data for; returns the list of patents for querying
          var citedListToQuery = checkDataForPatents(patent_no, patentBiblio[patent_no]["cited_patents"], "cited");
          var citingListToQuery = checkDataForPatents(patent_no, patentBiblio[patent_no]["citing_patents"], "citing");
          var relatedListToQuery = checkDataForPatents(patent_no, patentBiblio[patent_no]["related_patents"], "related");
          // add target patents that we already have epoBiblio data for to the forcePatent and forceBiblio maps
          // add to appropriate list of patent references under patent_no in the Mapped List on the Map page;
          mapExistingTargetPatents(patent_no, mapNewTargetPatents);

          function mapNewTargetPatents() {
            var epoQueryLists = makeAllQueryLists(patent_no, citedListToQuery, citingListToQuery, relatedListToQuery);
            debug("In mapNewTargetPatents, epoQueryLists: ", epoQueryLists);
            if (epoQueryLists.length > 0) {
              taskTracker.initialize("Fetching", on_mapping_complete);
              taskTracker.startTask(epoQueryLists.length);
            }
            else {
              on_mapping_complete();
            }
            for (var iList = 0; iList < epoQueryLists.length; iList++) {
            // get and process patent bibliographic data from the EPO API; epoQueryLists is a list of objects produced by
            // makeQueryLists, containing keys "list" which is a string (,patent1,patent2,...), "type" which is the type of
            // patents (cited, citing, or related), and "done", which tracks whether the EPO query has completed.

              (function(iL) {
               // need self-executing function called for each value of iList, so iList can be passed on to subsequent
               // function calls
                 var epoPatList = epoQueryLists[iL]["list"];
                 // query the EPO API
                 getEPOPatentData(epoPatList, on_EPO_query_success); // on_EPO_query_success is the callback for getEPOPatentData

                 function on_EPO_query_success(data) {
                 // called from epoQueryLists if EPO query is successful and returns 'data' in JSON; parse the JSON for biblio info
                 // patent_no, epoQueryLists, iList are defined in the containing scope
                   var processedList = parseEPOPatentData(data);
                   if (processedList) {
                     addEPOPatentDataToForceMap(patent_no, processedList, epoQueryLists, iL);
                     debug("In mapNewTargetPatents, adding queried EPO data for " + processedList.length + " " + 
                                  epoQueryLists[iL]["type"] + " patents to the force map");
                     updateForceMap();
                   }
                   taskTracker.finishTask(1);
                 }
               })(iList);
            }
          }
        }

/*
$.ajax({ type: "POST",
        url: "ops.epo.org/3.1/auth/accesstoken",
        headers: {"Authorization": "Basic xxxxxxx"},
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",    // this is default
        data: {"grant_type": "client_credentials"},
        dataType: "json"
      });

$.ajax({ type: "GET",              // works with epodoc or docdb
        url: "https://ops.epo.org/3.1/rest-services/published-data/publication/epodoc/EP2337452.A2",
        headers: {"Authorization": "Bearer access_token",
                  "Accept": "application/json"},
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",    // this is default
        dataType: "json"
      });

$.ajax({ type: "POST",             // bulk request only seems to work with epodoc
        url: "https://ops.epo.org/3.1/rest-services/published-data/publication/epodoc/biblio",
        headers: {"Authorization": "Bearer access_token",
                  "Accept": "application/json"},
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",    // this is default
        data: {"Request Body" : ,doc1,doc2,doc3 comma or newline separated list of patent documents, must begin with a comma (max 100/request)},
        dataType: "json"
      });
*/

        function getRelatedPatentList() {
        // Get a list of patents related to patent_no using the Google related art service; update relDone in status
        // patent_no is in scope of containing function on_click_map_buttons 
        // Looked at Network requests in chrome developer tools and noticed that related patent data is fetched using
        // POST requests to /patents/related/rpc; a very convenient way to get the related patent numbers!!
        // Use chrome extension 'Postman' to debug the POST query
        // Get the metadata (info in the panel on the right side of a related patents page.
          $.cookie("yappee_cl", clientCookie);                      // set clientCookie, removed in on_patent_data_complete
          $.ajax({ type: "POST",
                   url: "/patents/related/rpc",
                   headers: {"XmlHttpRequest": "2"},
                   contentType: "application/x-www-form-urlencoded; charset=UTF-8",    // this is default
                   data: {"m": "metadata",
                          "id": patent_no},
                   success: on_complete_related_metadata_post,
                   dataType: "json"
                 });

          function on_complete_related_metadata_post(data) {
          // in scope of getRelatedPatentList
          // extract top three search terms from the data returned by the metadata query;
          // get the patents related to patent_no, and using the search terms.
          // patent_no is in scope of containing function on_click_map_buttons 
            var searchTermsList = data[10][1];                   // the list of search terms that appears on the left side of a
            searchTerms = searchTermsList.slice(0,3).join(" ");  // related art page; concatenate the first 3 (like Google does)
            $.ajax({ type: "POST",
                     url: "/patents/related/rpc",
                     headers: {"XmlHttpRequest": "2"},
                     contentType: "application/x-www-form-urlencoded; charset=UTF-8",  // this is default
                     data: {"m": "search",
                           "q": searchTerms,
                           "c": "p",
                           "start": "",
                           "end": encodeURIComponent(dateString(new Date())),
                           "page": "0",
                           "pid": patent_no},
                    success: on_complete_related_patents_post,
                    dataType: "json"
                   });
          }

          function on_complete_related_patents_post(data) {
          // patent_no and status are in scope of containing function on_click_map_buttons 
          // extract the list of the related patents from the JSON
            debug("In on_complete_related_patents_post, related patent data returned from /related/rpc for patent "
                   + patent_no + " is ", data);
            patentBiblio[patent_no]["related_patents"] = [];
            var relatedList = data[5];
            for (var i = 0; i < relatedList.length; i++) {
              var patentInfo = relatedList[i][7];
              // sometimes relatedList contains non-patent data; Google ad links can show up so need to screen.
              if (patentInfo.length > 0) {
                var related_patent_no = patentInfo[0][0];
                patentBiblio[patent_no]["related_patents"].push(related_patent_no);
              }
            }
            status["relDone"] = true;
            on_patent_data_complete();
          }
        }

        function dateString(newDate) {
        // return a date string 'mm/dd/yyyy' from Date object newDate
          var dayNow = newDate.getDate().toString();
          dayNow = dayNow.length < 2 ? "0" + dayNow : dayNow;
          var monthNow = (newDate.getMonth() + 1).toString();
          monthNow = monthNow.length < 2 ? "0" + monthNow : monthNow;
          var yearNow = newDate.getFullYear().toString();
          return monthNow + "/" + dayNow + "/" + yearNow
        }

        function processPatentPage(doc) {
        // doc is the document for a Google patent page; parse it for title, inventors, assignee, cited patents, and
        // citing patents; add the data to the patentObj object for the patent;
        // patent_no, on_patent_data_complete, and status are in the scope of the containing function on_click_map_buttons;
        // update bibDone in status and callback on_patent_data_complete when done.
          var $docBody = $(doc).select("body");
          $docBody.remove("div.patent-description-section");
          var patentObj = patentBiblio[patent_no];
          var tia = getTIA($docBody);      // title, inventors, assignee in separate function, also used in setting up a patent tab
          var file_date = $("table.patent-bibdata td.patent-bibdata-heading:contains('Filing date') + td.single-patent-bibdata", $docBody).text();
          var pub_date = $("table.patent-bibdata td.patent-bibdata-heading:contains('Publication date') + td.single-patent-bibdata", $docBody).text();
          var abstract = $("div.abstract", $docBody).text();
          patentObj["title"] = (tia.title == "") ? "Title not available": tia.title;
          patentObj["inventors"] = (tia.inventors == "") ? "Inventors not available" : tia.inventors;
          patentObj["assignee"] = (tia.assignee == "") ? "Assignee not available" : tia.assignee;
          patentObj["shortAssignee"] = (tia.shortAssignee == "") ? "Not available" : tia.shortAssignee;
          patentObj["abstract"] = (abstract == "") ? "Not available" : abstract;
          patentObj["pub_date"] = (pub_date == "") ? "N/A" : pub_date;
          patentObj["file_date"] = (file_date == "") ? ((pub_date == "N/A") ? "" : pub_date) : file_date;
          var $cited = $("a#backward-citations ~ table.patent-data-table td.citation-patent a", $docBody);
          var cited_patents = new Array($cited.length);
          $cited.each(function(index) {cited_patents[index] = this.textContent;}); // $(this).text());});
          var $citing = $("a#forward-citations ~ table.patent-data-table td.citation-patent a", $docBody)
          var citing_patents = new Array($citing.length);
          $citing.each(function(index) {citing_patents[index] = this.textContent;}); // $(this).text());});
          patentObj["cited_patents"] = cited_patents;
          patentObj["citing_patents"] = citing_patents;
          status["bibDone"] = true;
          on_patent_data_complete();
        }

        function checkDataForPatents(source_patent, inList, type) {
        // check epoBiblio to see which patents in inList we have already queried EPO for biblio data;
        // add patents with data to the lists of nodes and links for the forcePatent and forceBiblio maps
        // with source_patent as its focus; add patents without data to the outList for querying EPO; return
        // a list outList of the patents for which there is no biblio data; $sourceContainer is the jQuery
        // element in the Mapped List on the Map page that contains the entry for source_patent.
          var outList = [];
          for (var i = 0; i < inList.length; i++) {
            var target_patent = inList[i];
            if (epoBiblio[target_patent]) {                   // if we already have EPO data for this patent
              var sourceNode = patentsHistory[source_patent];
              var link_key = source_patent + target_patent + type;
              if (!(link_key in sourceNode.targetPatentLinks)) {
                // biblio data exists for target_patent, but need to create link to this sourceNode
                createForceLink(source_patent, target_patent, type, link_key);   // one of two places where links are created
              }
            }
            else {
              outList.push(target_patent);
            }
          }
          return outList;
        }

        function makeQueryLists(inList, type) {
        // inList is a list of cited, citing, or related patents; split each into groups of 15 and return a list of objects
        // containing keys "list": subList of patents to query, "type" of the subList (cited, citing, or related), and
        // "done", which tracks whether the query has completed.

          var sizeList = 15;                                          // split patents in inList into subLists of 15
          var nList = Math.floor(inList.length/sizeList);
          var queryLists = [];
          for (var iList = 0; iList < nList; iList++) {
            var subList = inList.slice(iList*sizeList, (iList+1)*sizeList);
            queryLists.push({"list": makeEPOQueryList(subList), "type": type, "done": false});
          }
          if (nList*sizeList < inList.length) {                      // the elements at the end of inList
            var subList = inList.slice(nList*sizeList);
            queryLists.push({"list": makeEPOQueryList(subList), "type": type, "done": false});
          }
          return queryLists;
        }

        function makeAllQueryLists(source_patent, q_citedList, q_citingList, q_relatedList) {
        // source_patent is the central patent of the forcePatent and forceBiblio maps;
        // given arrays citedList, citingList, and relatedList, split each into arrays of length 15 for
        // querying EPO in small groups; send to makeEPOQueryList to make comma-separated strings; process
        // each list separately since we want to display the links with different colors on the force map
        // return a list of EPO query lists and associated type of list (cited, citing, etc).
          return [].concat(makeQueryLists(q_citedList, "cited"), makeQueryLists(q_citingList, "citing"),
                           makeQueryLists(q_relatedList, "related")); 
        }
      }

      function makeEPOQueryList(patentList) {
      // given patentList list of patent publications as obtained from Google, return a string suitable for a bulk
      // POST query to the EPO API; the string is a list of comma-separated patent publication numbers that also
      // starts with a comma; publication numbers are formatted using formatEPOPatentNumber(patent_no) so EPO can
      // understand the request; called from makeQueryLists and on_mouseover_fullview_button.
        var queryList = "";
        for (var i = 0; i < patentList.length; i++) {
          var patent_no = patentList[i];                           // Google format
          var formattedPN = formatEPOPatentNumber(patent_no);         // EPO query format
          if (formattedPN != "") {
            for (var iForm = 0; iForm < formattedPN.length; iForm++) {
              queryList = queryList + "," + formattedPN[iForm];
              var epo_patent_no = formattedPN[iForm].replace(/\./g, "");
              patentNoEPOtoGoogle[epo_patent_no] = patent_no;        // add to EPO to Google patent doc number dictionary
            }
          }
        }
        return queryList;

        function formatEPOPatentNumber(patent_no) {
        // patent_no is a patent number as it appears in the cited patents sections on the Google patent page.
        // It is a string with the country code, publication prefix, publication number, postfix, and kind
        // and no spaces in between.  Returns a document ID string suitable for the EPO API.
        // US patent numbers start with various letters if they are not utility patents; older JP patent numbers
        // can start with a letter like H or S; called from makeEPOQueryList.

          // use global variable rExpPat = /([A-Z]{2})([A-Z]*)(\d+)([A-C,G]?(?=([A-Z]\d?)?$))/
          var match = rExpPat.exec(patent_no);
          if (match) {
            var cc = match[1]; var pub_type = match[2]; var pub_no = match[3]; var postfix = match[4]; var kind = match[5];
            var us_application_flag = false;                   // special handling needed for US applications (see below)
            var formattedList = [];
            switch (cc) {
              case "US":
                if (pub_no.length == 11 && pub_no[4] == "0") { // EPO API removes the leading zero of a US application publication
                  pub_no = pub_no.slice(0,4) + pub_no.slice(5);
                  us_application_flag = true;
                }
                switch (pub_type) {
                  case "D":
                    pub_no = pub_no + "S";
                    break;
                  case "PP":
                    pub_no = pub_no + "P";
                    pub_type = ""
                    break;
                  case "RE":
                    pub_no = pub_no + "E";
                    break;
                  default:
                }
                break;
              case "WO":
                intDoc = parseInt(pub_no.slice(4,10));               // get document number (six digits in Google format)
                intYear = parseInt(pub_no.slice(0,4));
                switch (true) {                                     // fix the document number
                  case intYear <= 2002:
                    if (intDoc < 100000) {
                      pub_no = pub_no.slice(0,4) + pub_no.slice(5); // five-digit document number if <10000;
                    }
                    break;
                }
                switch (true) {                                     // fix the year
                  case intYear <= 2003:                             // use two-digit year for years 2003 and previous
                    pub_no = pub_no.slice(2);
                    break;
                }
                break;
            }
            formattedList.push(cc + pub_type + pub_no + postfix + (kind ? "." + kind : ""));
            // Google does not distinguish between US utility applications and plant applications, but EPO does!
            // So need to query EPO with the application number (utility patent) and the application number with
            // 'P' appended (plant patent) if us_application_flag is set.
            if (us_application_flag) {
              formattedList.push(cc + pub_type + pub_no + postfix + "P" + (kind ? "." + kind : ""));
            }
            return formattedList;
          }
          else {
            debug("In formatEPOPatentNumber, could not match '" + patent_no + "'. Skipping...");
            return '';
          }
        }
      }

      function removePatentFromFavorites(patent_no, $favBtn, page_type) {
        updatePatentListTrackers("favorites", $favoritesList, patent_no, $favBtn);
        if (patentsPlotted[patent_no]) {                            // if the patent is mapped
          if (page_type == "favorites-list") {                      // special case when favorite patent is removed via Favorites
            mouseout_patent_list_patent(patent_no);                 // List; mimic mouseout event: FavList entry has been deleted
          }
          else {
            var marker = d3.select("g.force-patent-marker[data-patent=" + patent_no + "]");
            updateMarkerOnForceMap(marker, page_type);              // update the marker appearance
          }
        }
      }

      function removePatentFromMapped(patent_no, $mapBtn, page_type) {
      // remove the patents linked to patent_no (unless they are source patents); remove the patent from the mapped list,
      // but do not remove it from the map (it may be a targetNode for another source patent)
        var patentNode = patentsPlotted[patent_no];
        deleteLinksToTargetPatentsFromMap(patentNode, null);        // no callback when removing a patent from the mapped list
        patentNode.source = false;
        updateLegend();
        updateSymbols();
        forcePatent.start();                                              // let the map rearrange itself significantly
        updatePatentListTrackers("map", $mappedList, patent_no, $mapBtn);
        if (page_type == "mapped-list") {                       // special case when mapped patent is removed via Mapped
          mouseout_patent_list_patent(patent_no);               // List; mimic mouseout event: Mapped List entry has been deleted
        }
        else {
          var marker = d3.select("g.force-patent-marker[data-patent=" + patent_no + "]");
          updateMarkerOnForceMap(marker, page_type);                        // update the marker appearance
        }
      }
      
      function updatePatentListTrackers(patList, $patList, patent_no, $pressedBtn) {
      // utility function called from removePatentFromMapped, deletePNode (when the node is a source node),
      // and removePatentFromFavorites; patList is "map" or "favorites", $patList is the jQuery object for the
      // $mappedList or $favoritesList patent lists on the Map page, $pressedBtn is the jQuery object for the
      // button that was clicked.
        toggleBtn(patent_no, $pressedBtn, "remove");
        $patList.find("div.patent-list-entry[data-patent='" + patent_no + "']").remove();
        patentLists[patList].splice(patentLists[patList].indexOf(patent_no), 1);
      }

