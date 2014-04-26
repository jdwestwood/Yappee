// javascript for the buttons at the top of the Map page

// attach event handlers to buttons above the force map on the Map page
$("input.input-patent").on("keydown", on_keydown_input_patent)
                       .on("paste", on_keydown_input_patent)        // use same event handler as for keydown
                       .on("keyup", on_keyup_input_patent);
$("span.btn-go").on("click", on_click_go_btn);
$("button.btn-random").on("click", on_click_random_btn)
                      .on("mousedown", divMouseDown);  // prevent buttons from getting focus with blue outline when clicked
$("button.btn-fun").on("click", on_click_fun_btn)
                     .on("mousedown", divMouseDown);
$("button.btn-undo").on("click", on_click_undo_delete_btn)
                    .on("mousedown", divMouseDown);
$("button.btn-clear").on("click", on_click_clear_btn)
                     .on("mousedown", divMouseDown);

var funPatents = ["US2834031", "US6025810", "US5571247", "US4605000", "US5606804", "US6329919", "US6099319",
                  "US4247283", "CA2010302", "US5107620", "US5456625", "US5394661", "US5572207", "US7283427",
                  "US766171",  "US748626",  "US2026082", "US821393",  "US1909537", "US5960411", "US4378116",
                  "US3655201", "US4708078", "US6733797"]

function on_keydown_input_patent(event) {
// handler for keydown and paste events in the text input box above the force map on the Map page
  event.stopImmediatePropagation();                  // needed to stop keydown event from often firing twice!!
  patentPicker.clearError();
  if (event.keyCode == 13) {                         // Enter key
    $(this).off("keydown");                          // do not respond if use holds the key down
    on_click_go_btn(event);
  }
}


function on_keyup_input_patent(event) {
// handler for keyup event in the text input box above the force map on the Map page
  event.stopImmediatePropagation();
  if (event.keyCode == 13) {                         // Enter key
    $(this).on("keydown", on_keydown_input_patent);  // re-attach event handler
  }
}

function on_click_go_btn(event) {
// handler for click event on the Go button above the force map on the Map page; also called from on_keydown_input_patent
// (handler when user presses the Enter key in the patent number input box)
  $("input.input-patent").on("keydown", on_keydown_input_patent);  // re-attach event handler
  var enteredText = $("input.input-patent").val();
  debug("In on-click_go_btn, input text is " + enteredText);
  setGoButtonState(true);                                  // disable button and click handler while mapping random patent
  patentPicker.validatePatent(enteredText, on_patent_validated);

  function on_patent_validated(validResp) {
  // callback for patentPicker.validatePatent; if enteredText is a valid patent, validResp is an object containing
  // a valid Google url for the patent (with kind code) and the label (without the kind code) for labeling
  // the patent tab; if enteredText has an invalid format or is not in Google's database, validResp contains an
  // error message.
    if (validResp.url) {
      patentPicker.getPatent(validResp.url, validResp.label, on_patent_data_complete);
    }
    else {
      patentPicker.showError(validResp.error);
      setGoButtonState(false);                             // re-enable button and click handler
    }
  }

  function on_patent_data_complete(patentLabel) {
  // callback for patentPicker.getPatent
    window.setTimeout(delayClick.bind(undefined, patentLabel), 1000);

    function delayClick() {
      var patentLabel = arguments[0];
      var $aTab = $("a[data-tabname='" + patentLabel + "']");
      $aTab.click();
      setGoButtonState(false);                                    // re-enable button
    }
  }

  function setGoButtonState(state) {
  // set appearance of the 'Go' button at the top of the force map.
    var $btn = $("span.btn-go");
    if (state) {
      $btn.addClass("disabled");
    }
    else {
      $btn.removeClass("disabled");
    }
  }
}

function on_click_random_btn(event) {
  setRandomButtonState(true);                                    // disable button while random patent is mapped
  randomPatentPicker.mapRandomPatent(on_random_patent_complete); // on_random_patent_complete is the callback

  function on_random_patent_complete(patentLabel) {
    window.setTimeout(delayClick.bind(undefined, patentLabel), 1000);

    function delayClick() {
      var patentLabel = arguments[0];
      var $aTab = $("a[data-tabname='" + patentLabel + "']");
      $aTab.click();
      setRandomButtonState(false);                                 // re-enable button when done mapping
    }
  }

  function setRandomButtonState(state) {
  // set appearance of the 'Random' button at the top of the force map.
      $("button.btn-random").prop('disabled', state);
  }
}

function on_click_fun_btn(event) {
  setFunButtonState(true);                                    // disable button while fun patent is mapped
  var randIndex = Math.floor(funPatents.length*Math.random());
  var patent_label = funPatents[randIndex];
  var patent_url = "/patents/" + patent_label;

  checkGooglePatent(patent_url, on_check_patent_complete);

  function on_check_patent_complete(respObject) {
  // checkGooglePatent returns an object with properties 'data' and 'textStatus' for a valid Google patent_url or
  // 'error' and 'textStatus' for an invalid Google patent_url.
    if (!respObject.error) {
      patentPicker.getPatent(patent_url, patent_label, on_fun_patent_complete);
    }
    else {
      debug("In on_click_fun_button, patent " + patent_label + " was not found on Google patents");
      setFunButtonState(false);
    }
  }

  function on_fun_patent_complete(patentLabel) {
  // callback for patentPicker.getPatent
    window.setTimeout(delayClick.bind(undefined, patentLabel), 1000);

    function delayClick() {
      var patentLabel = arguments[0];
      var $aTab = $("a[data-tabname='" + patentLabel + "']");
      $aTab.click();
      setFunButtonState(false);                                 // re-enable button
    }
  }

  function setFunButtonState(state) {
  // set appearance of the 'Fun' button at the top of the force map.
      $("button.btn-fun").prop('disabled', state);
  }
}

function on_click_undo_delete_btn(event) {
// click event handler for the 'Undo' button on the Map page
  if (patentLists["clearFlag"]) {
    undoClear(on_undelete_complete);
  }
  else {
    var patent_no = patentLists["deleted"].slice(-1)[0];         // take last entry in the deleted list
    undeletePatent(patent_no, "single", "undo_delete", on_undelete_complete);
  }

  function on_undelete_complete() {
    setUndoButtonState();                            // set state based on whether deleted list contains any patents
    // last action is to enable the Clear button, but set the state based on whether patentsPlotted has any patents
    setClearButtonState();
  }
}

function addPatentToDeletedList(patent_no) {
// add patent_no to deleted list and update CSS for the undo button
  patentLists["deleted"].push(patent_no);
}

function removePatentFromDeletedList(patent_no) {
// test if patent_no is in the deleted list and if so remove it.
  var index = patentLists["deleted"].indexOf(patent_no);
  if (index != -1) {
    patentLists["deleted"].splice(index, 1);   // remove from the deleted list
  }
}

function setUndoButtonState(state) {
// set appearance of the 'Undo' button at the top of the force map; if state is provided, set the button to
// that state; if not, set the state based on whether deleted list contains any patents; called from
// on_click_delete_btn$, on_click_delete_btn, on_click_clear_btn, and undoClear
  if (arguments.length > 0) {
    $("button.btn-undo").prop('disabled', state);
  }
  else {
    if (patentLists["deleted"].length == 0) {
      $("button.btn-undo").prop('disabled', true);
    }
    else {
      $("button.btn-undo").prop('disabled', false);
    }
  }
}

function setClearButtonState(state) {
// set appearance of the 'Clear' button at the top of the force map; if state is provided, set the button to
// that state; if not, set the state based on whether patentsPlotted contains any patentNodes; called from
// mapNewTargetPatents, on_click_clear_btn, and undoClear.
  if (arguments.length > 0) {
    $("button.btn-clear").prop('disabled', state);
  }
  else {
    if (_.isEmpty(patentsPlotted)) {
      $("button.btn-clear").prop('disabled', true);
    }
    else {
      $("button.btn-clear").prop('disabled', false);
    }
  }
}

function on_click_clear_btn(event) {
// event handler for the 'Click' button at the top of the force map
  setClearButtonState(true);                     // first action is to disable the Clear button, so user cannot click it twice
  preserveClearedLists();                        // preserve some history in case user undoes the Clear;
  var mapPatentList = patentLists["cleared"]["map"];
  // delete mapped patents one at a time in reverse order; the deletePatentFromMap function takes care of
  // calling updateForceMap when 'single' mapped patents and associated target patents are deleted
  var iP = mapPatentList.length;
  deleteMappedPatent();

  function deleteMappedPatent() {
    if (iP > 0) {
      iP--;
      var patent_no = mapPatentList[iP];
      deletePatentFromMap(patent_no, "single", deleteMappedPatent);    // deleteMappedPatent is the callback
    }
    else {
      deleteRemainingTargetPatents();
    }
  }

  function deleteRemainingTargetPatents() {
  // delete any remaining target patents whose source patent(s) were not plotted 
    for (patent_no in patentsPlotted) {
      deletePatentFromMap(patent_no, "group", undefined);
      patentLists["cleared"]["target"].unshift(patent_no);        // add to beginning of list to help preserve legend colors
    }
    // need to call updateForceMap since remaining target patents were deleted as a 'group'.
    updateForceMap();
    // the deleted list contains the patents that were just deleted; we need a new list now
    initializeDeletedList();
    patentLists["clearFlag"] = true;
    setUndoButtonState(false);                                     // set Undo button state enabled so can undo the Clear
  }
}

function initializeDeletedList() {
// called from on_click_map_buttons and on_click_clear_btn.
  patentLists["deleted"] = [];                                    // remove 'Clear' from deleted list; it is now empty
}

function preserveClearedLists() {
// preserve legend and deleted lists needed to undo a Clear command; called from on_click_clear_btn.
  var cleared = patentLists["cleared"];
  cleared["deleted"] = patentLists["deleted"].slice();            // save deleted list in case we need to Undo the Clear
  cleared["map"] = patentLists["map"].slice();                    // clone the mapped patent list
}

function undoClear(on_undo_clear_complete) {
// undo a Clear command; called from on_click_undo_delete_btn; call on_undo_clear_complete when done.
  setUndoButtonState(true);                // immediately disable the Undo button (might be re-enabled later)
  // bring back the list of deleted patents when Clear was clicked so do not re-plot them
  restoreClearedLists();
  patentMapPlot.initialize();              // we will disregard any zooming that was done before the Clear
  restoreClearedPatents(on_restore_complete);

  function on_restore_complete() {
    initializeClearedLists();
    on_undo_clear_complete();
  }
}

function restoreClearedLists() {
// restore deleted lists to previous saved state; called from undoClear.
  patentLists["deleted"] = patentLists["cleared"]["deleted"];
}

function restoreClearedPatents(on_restore_complete) {
// remap the patents that were deleted when the 'Clear' button was originally clicked; called from undoClear;
// on_restore_complete is the callback called when function is finished
  var mapPatentList = patentLists["cleared"]["map"];
  var targetPatentList = patentLists["cleared"]["target"];
  // undelete formerly mapped patents and isolated target patents in reverse order that they were Cleared
  restoreTargetPatents();

  function restoreTargetPatents() {
  // undelete any isolated target patents in reverse order that they were Cleared
    var nP = targetPatentList.length;                           // as each patent was undeleted, it was removed from the list
    if (nP > 0) {
      var patent_no = targetPatentList[0];                        // always take the first entry
      undeletePatent(patent_no, "group", "undo_clear", restoreTargetPatents);      // restoreTargetPatents is the callback
    }
    else {
      // for 'group' undeletes, undeletePatent does not call updateForceMap; we need to call it here
      updateForceMap();
      restoreMappedPatents();
    }
  }

  function restoreMappedPatents() {
  // undelete mapped patents in the order they were originally plotted to try to preserve the original legend colors.
  // undelete the patent at index 0 in mapPatentList; waits for undeleting of each mapped patent and associated
  // target patents to be completed before recursively calling itself on the next mapped patent
    var nP = mapPatentList.length;                            // as each patent was undeleted, it was removed from the list
    if (nP > 0) {
      var patent_no = mapPatentList[0];                       // always take the first entry
      if (nP > 1) {
        // for 'single' undeletes, undeletePatent takes care of calling updateForceMap
        undeletePatent(patent_no, "single", "undo_clear", restoreMappedPatents);    // restoreMappedPatent is the callback
      }
      else {                                                          // last patent in the list
        undeletePatent(patent_no, "single", "undo_clear", on_restore_complete);     // on_restore_complete is the callback
      }
    }
    else {
      on_restore_complete();
    }
  }
}

function initializeClearedLists() {
// empty out the patent lists that support clear and undoing clear; called from on_click_map_buttons and
// undoClear.
  var cleared = patentLists["cleared"];
  cleared["map"] = [];
  cleared["target"] = [];
  cleared["deleted"] = [];
  patentLists["clearFlag"] = false;
}

function divMouseDown(event) {
// prevent the blue outline from appearing on a clicked div button; attached to div#right-toolbar-buttons on
// Google Patent page and to bootstrap buttons at the top of the Map page
  event.preventDefault();
//          event.stopPropagation();
}
