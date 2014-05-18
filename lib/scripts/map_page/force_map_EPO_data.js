// javascript for querying EPO for patent biblio data and parsing the returned data

function getEPOPatentData(epoPatList, on_success) {
// get bibliographic data for the patents listed in epoPatList from the EPO API; epoPatList is a
// string (,patent1,patent2,...); on_success is the callback function, called as on_success(data), with
// data in JSON form; called from mapReferencePatents with locally defined on_EPO_query_success as the on_success callback;
// and called from on_mouseover_fullview_button with locally defined on_EPO_query_success as the callback.
//
// because the EPO API blacklists some of the Heroku servers, I need to run EPO queries from the AWS development
// server; the ajax request is cross-domain to port 8081, and the server is set up with CORS to validate the
// request with the client.
  if (epoPatList != "") {
    debug("In getEPOPatentData, patent query list is: ", epoPatList);
//    cookieTracker.start();                             // does nothing - clientCookie cannot be sent to a different domain
    $.ajax({ type: "POST",
             url: "http://" + EPO_QUERY_DOMAIN + EPO_QUERY_PATH,
             crossDomain: true,
             xhrFields: {withCredentials: true},              // for CORS, send cookies with the cross-domain request
             contentType: "application/x-www-form-urlencoded; charset=UTF-8",    // this is default
             // Request Body is ,patent1,patent2,...; CacheKey is refs_patent+epoPatList to ask server to pull
             // data from cache if it exists
             data: {"Request Body": epoPatList, "CacheKey": "refs_" + CryptoJS.MD5(epoPatList)},
             dataType: "json",
             success: on_success,
             error: function(req, status, error) {
                      debug("In getEPOPatentData, error returned from POST request");
                      debug(status);
                      debug(error);
                      taskTracker.reportError("HTTP error getting EPO patent data. Please try later.")}
           });
//    cookieTracker.end(0);                                  // remove clientCookie
  }
}

function parseEPOPatentData(epoJSON) {
// parse the epoJSON containing the data returned by the EPO API; return processedList, a list of patent_no's
// successfully parsed; parsed data stored in global epoBiblio using Google patent_no as the key; called from
// on_EPO_query_success in mapReferencePatents.
  if (epoJSON["ops:world-patent-data"]) {                                   // got EPO data
    var epoPatents = epoJSON["ops:world-patent-data"]["exchange-documents"]["exchange-document"];
    epoPatents = (epoPatents instanceof Array) ? epoPatents : [epoPatents];   // a single patent is not returned as a list,
    debug("Got " + epoPatents.length + " documents back from EPO");            // so make one
    var processedList = [], unprocessedList = []; dupList = []; notFoundList = []; USApplicationCount = 0;
    epoPatents.sort(function(a, b) {                                        // process all status = 'not found' patents last
                      if (!a["@status"] && b["status"]) {                   // so can eliminate the ones that were not found
                        return -1;                                          // due to ambiguity in Google for US utility vs
                      }                                                     // plant applications. Must query EPO for both
                      if (a["@status"] && !b["status"]) {                   // but one will always be 'not found'.
                        return 1;
                      }
                      return 0;
                    });
    for (var iPat = 0; iPat < epoPatents.length; iPat++) {
      try {
        var epoPatent = epoPatents[iPat];
        var country = epoPatent["@country"];
        var doc_number = epoPatent["@doc-number"];
        // kind will not be present if a patent is not found in EPO database
        var kind =  (epoPatent["@kind"]) ? epoPatent["@kind"] : "";
        // my queries to EPO for US patent docs never have a kind code
        var epo_patent_no = country + doc_number + ((country == "US") ? "" : kind);
        // the "@doc-number" is the true EPO docdb number; the epodoc number is different for US reissue, plant,
        // and design patents, in which case we need to append the first letter of the kind code...
        epo_patent_no = epo_patent_no + ((country == "US" &&
                    (kind.slice(0,1) == "E" || kind.slice(0,1) == "P" || kind.slice(0,1) == "S")) ? kind.slice(0,1) : "");
        // convert from EPO patent doc number to Google patent doc number to use as key in epoBiblio
        var patent_no = patentNoEPOtoGoogle[epo_patent_no];
        if (!(patent_no in epoBiblio) && epoPatent["@status"] != "not found") {
          // get pubDate first so can screen some patents out, like US B1 patents prior to 1/2/2001

          var pubDate = "";                                                 // get the publication date
          var pub_reference = epoPatent["bibliographic-data"]["publication-reference"];
          if (pub_reference) {
            var document_id = pub_reference["document-id"];
            pubDate = (document_id instanceof Array) ? makeGoogleDate(document_id[1]["date"]["$"]) : "";
          }

          var is_USB_123 = (country == "US" && kind[0] == "B");             // if patent is US kind B1,B2,B3 before 2001
          var is_pre_2001 = (moment.utc(pubDate).valueOf() < moment.utc("Jan 2, 2001"));
          if (is_USB_123 && is_pre_2001) {                                  // skip it
            debug("In parseEPOPatentData: patent " + patent_no + kind + " is US_B pre-2001");
            dupList.push(patent_no + kind);
            continue;
          }

          var abstractText = "";                                            // get the abstract
          var abstract = epoPatent["abstract"]
          if (abstract) {
            // if more than one abstract, [0] is in English
            abstractP = (abstract instanceof Array) ? abstract[0]["p"] : abstract["p"];
            if (abstractP) {
              if (abstractP instanceof Array) {                             // if more than one "p", concatenate them
                var absList = [];
                for (var iP = 0; iP < abstractP.length; iP++) {
                  absList.push(abstractP[iP]["$"]);
                }
                abstractText = absList.join(", ");
              }
              else {
                abstractText = abstractP["$"];
              }
            }
          }

          var inventionTitle = "";                                          // get the invention title
          var invention_title = epoPatent["bibliographic-data"]["invention-title"];
          if (invention_title) {
            inventionTitle = (invention_title instanceof Array) ?
                                       makeGoogleTitle(invention_title[0]["$"]) : makeGoogleTitle(invention_title["$"]);
          }

          // get the assignee and the inventors
          var assigneeList = [];                                            // store the assignees and the
          var inventorList = [];                                            // inventors listed in the EPO biblio
          var parties = epoPatent["bibliographic-data"]["parties"];
          if (parties) {
            // process the assignees
            var applicants = parties["applicants"];
            if (applicants) {
              var applicant = applicants["applicant"];
              if (applicant instanceof Array) {                             // often inventors are also listed as applicants
                for (var iApp = 0; iApp < applicant.length; iApp++) {       // get all assignees; compare against inventors
                  if (applicant[iApp]["@data-format"] == "epodoc") {        // later; @data-format can also be "original"
                    var epoName = applicant[iApp]["applicant-name"]["name"]["$"];
                    var gooName = makeGoogleName(epoName);
                    if (assigneeList.indexOf(gooName) == -1) {              // there are duplicate assignee names sometimes
                      assigneeList.push(gooName);
                    }
                  }
                }
              }
              else {
                var epoName = applicant["applicant-name"]["name"]["$"];
                var gooName = makeGoogleName(epoName);
                assigneeList.push(gooName);
              }
            }
            // process the inventors
            var inventors = parties["inventors"];
            if (inventors) {
              var inventor = inventors["inventor"];
              if (inventor instanceof Array) {
                for (var iInv = 0; iInv < inventor.length; iInv++) {
                  if (inventor[iInv]["@data-format"] == "epodoc") {        // 'epodoc' format has no commas or periods
                    var epoName = inventor[iInv]["inventor-name"]["name"]["$"];
                    var gooName = makeGoogleName(epoName);
                    if (inventorList.indexOf(gooName) == -1) {
                      inventorList.push(gooName);
                    }
                  }
                }
              }
              else {
                var epoName = inventor["inventor-name"]["name"]["$"];
                var gooName = makeGoogleName(epoName);
                inventorList.push(gooName);
              }
            }
          }

          // assigneeList might have names in the inventorList mixed in; get rid of these names in the assignees and
          // store the remaining names in finalAssigneeList
          var finalAssigneeList = [];
          var shortAssigneeList = [];
          for (var iApp = 0; iApp < assigneeList.length; iApp++) {
            var assignee = assigneeList[iApp];
            if (inventorList.indexOf(assignee) == -1) {
              assignee = finalizeEPOAssignee(assignee);                   // get rid of EPO quirks in assignee names
              finalAssigneeList.push(assignee);
              shortAssigneeList.push(makeShort(assignee));
            }
          }

          // sometimes an inventor name has the assignee mixed in, so check each one
          for (var iInv = 0; iInv < inventorList.length; iInv++) {
            var gooName = makeGoogleInventor(inventorList[iInv]);                // put lastname last
            inventorList[iInv] = checkInventorName(gooName, finalAssigneeList);  // strip out assignee words
          }

          // for older patents, EPO does not always have an assignee, in which case finalAssigneeList and shortAssigneeList
          // are empty at this point; assume that the assignee(s) are the inventors in this case
          if (finalAssigneeList.length == 0) {
            for (var iInv = 0; iInv < inventorList.length; iInv++) {
              finalAssigneeList.push(inventorList[iInv]);
              shortAssigneeList.push(makeShort(inventorList[iInv]));
            }
          }

          var fileDate = "";                                                // get the filing date
          var app_reference = epoPatent["bibliographic-data"]["application-reference"];
          if (app_reference) {
            var document_id = app_reference["document-id"];
            if (document_id instanceof Array) {
              if (document_id[1]["date"]) {
                fileDate = makeGoogleDate(document_id[1]["date"]["$"]);
              }
            }
          }
          // very old patents only have a publication date; still want to be able to plot them
          fileDate = (fileDate == "") ? pubDate: fileDate;
        }
        else {
          if (epoBiblio[patent_no]) {
            // if duplicate because we query US patent applications twice (as utility and as plant)
            if (!(country == "US" && patent_no.length == 13)) {
              dupList.push(patent_no);                                       // then do not count as duplicate
              debug("In on_get_EPO_date: patent " + ((country == "US") ? patent_no + kind : patent_no) + " is duplicate");
            }
            else {
              USApplicationCount += 1;
            }
          }
          else {
            notFoundList.push(patent_no);
            debug("In on_get_EPO_date: patent " + patent_no + " not found");
           }
          continue;
        }
      }
      catch(error) {
        unprocessedList.push(patent_no);
        debug("In parseEPOPatentData, error thrown: " + error.name + ": " + error.message);
        debug("      Error parsing patent " + patent_no);
        debug(epoPatent);
        continue;
      }
      var finalAssignee = finalAssigneeList.join(", ");
      var shortAssignee = shortAssigneeList.sort().join(" ");
      var finalInventor = inventorList.join(", ");
      epoBiblio[patent_no] = {};                                          // add the patent to the epoBiblio list
      epoBiblio[patent_no]["title"] = (inventionTitle == "") ? "Title not available" : inventionTitle;
      epoBiblio[patent_no]["abstract"] = (abstractText == "") ? "Not available" : abstractText;
      epoBiblio[patent_no]["pub_date"] = (pubDate == "") ? "N/A" : pubDate;
      epoBiblio[patent_no]["assignee"] = (finalAssignee == "") ? "Assignee not available" : finalAssignee;
      epoBiblio[patent_no]["shortAssignee"] = (shortAssignee == "") ? "Not available": shortAssignee;
      epoBiblio[patent_no]["inventors"] = (finalInventor == "") ? "Inventors not available" : finalInventor;
      epoBiblio[patent_no]["file_date"] = fileDate;
      processedList.push(patent_no);                                      // add to list of patents successfully processed
      debug("In parseEPOPatentData: parsed patent " + patent_no);
      debug(epoPatent);
    }
    debug("In parseEPOPatentData, " + processedList.length + " successfully parsed patents:");
    debug(processedList);
    debug("                    " + unprocessedList.length + " patents not parsed:");
    debug(unprocessedList);
    debug("                    " + dupList.length +
          " patents were duplicates (between cited/citing and related lists?) or US_B pre-2001:");
    debug(dupList);
    debug("US applications not found due to querying as both utility and plant applications: " + USApplicationCount);
    debug("                    " + notFoundList.length + " patents not found:");
    debug(notFoundList);
    return processedList;                             // successfully parsed data returned from EPO API
  }
  else {                                              // got error message
    debug("In parseEPOPatentData, error getting EPO patent data:");
    debug(epoJSON);
    taskTracker.reportError("Error from EPO patent API. Please try later.")
    return false;                                     // failed to parse data returned from EPO API
  }
}

function finalizeEPOAssignee(assignee) {
// called from parseEPOPatentData when assignee name is not also in the inventors list. EPO removes a possessive in an
// assignee name (e.g. John's Bagels in the original assignee becomes JOHN S BAGELS in the EPO assignee); convert back
// to a possessive if an S appears by itself; need exception for company names that end in SA.
  return assignee.replace(/S A$|Sa$/, "SA").replace(/Llc/, "LLC").replace(/A G$|Ag$/, "AG")
                   .replace(/G M B H$|Gmbh$/, "GmbH").replace(" S ", "'s ");
}

function makeGoogleTitle(titleStr) {
// take an EPO biblio titleStr (all caps) and return mixed upper/lower case (Google format);
// in the regex, ^ matches the beginning of the string.
  return titleStr.toLowerCase().replace(/^\b\w/g, function(match) {return match.toUpperCase();});
}

function checkInventorName(gooName, assigneeList) {
  var retName = gooName;
  for (var iApp = 0; iApp < assigneeList.length; iApp++) {
    var assigneeName = assigneeList[iApp];
    // sometimes an inventor name has the assignee mixed in!
    if (assigneeName.search(/Inc|Co|Llc|Ltd|Int|Tech|Ind|Nv/) != -1) {    // if assignee looks like a company
      aList = assigneeName.match(/(\S+)/g);                               // remove the words in assignee from inventor
      if (aList) {
        aList.forEach( function(val, ind, arr) {retName = retName.replace(/\bval\b/g, " ");});    // \b is a word boundary
        retName = retName.replace(/\s+/g, " ");
      }
    }
  }
  return retName;
}

function makeGoogleInventor(nameStr) {
// massage the inventor names from EPO: put lastname last instead of first
// the makeGoogleName function must already have been run
  if (!nameStr) return "";
  var names = nameStr.match(/(\S+)/g);
  names.forEach(function(val, i, array) {if (val.length == 1) array[i] += ".";});
  switch (names.length) {
    case 0:
      return "";
      break;
    case 1:
      return names[1];
      break;
    case 2:
      return names[1] + " " + names[0];
      break;
    default:
      switch (names[0]) {
        case "Von" : case "Van" :
          names[0] = names[0].toLowerCase();
          switch (names[1]) {
            case "De": case "Der":
              names[1] = names[1].toLowerCase();
              names.push(names[0], names[1], names[2]);          // add the first three entries in names to the end of names
              names = names.slice(3);
              break;
            default:
              names.push(names[0], names[1]);          // add the first two entries in names to the end of names
              names = names.slice(2);
          }
          break;
        case "De": case "Del":
          names[0] = names[0].toLowerCase();
          switch (names[1]) {
            case "La":
              names[1] = names[1].toLowerCase();
              names.push(names[0], names[1], names[2]);
              names = names.slice(3);
              break;
            default:
              names.push(names[0], names[1]);
              names = names.slice(2);
          }
          break;
        default:
          names.push(names[0]);
          names = names.slice(1);
      }
  }
  switch (names[0]) {
    case "Ii": case "Iii": case "Iv":
      names[0] = names[0].toUpperCase();              // no break!
    case "Jr": case "Sr":
      names.push(names[0]);
      names = names.slice(1);
      break;
    default:
  }
  return names.join(" ");
}
