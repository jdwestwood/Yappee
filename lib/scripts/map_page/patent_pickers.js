// javascript for the PatentPicker and RandomPatentPicker classes associated with the Go, Random, and Fun
// buttons on the Map page

var patentRange = {                // range of numbers for random US patent selection
   "min": 1,
   "max": 8670000
}

var randomPatentPicker = new RandomPatentPicker();
var patentPicker = new PatentPicker();

function PatentPicker() {
// map a patent number entered by the user in the input box at the top of the force map; called from on_click_btn.

  this.validatePatent = function(inputText, on_patent_validated) {
  // check if inputText is a valid patent number; if so, call callback on_patent_validated with an object
  // containing the full patent number (includes the kind code) and the patent_no (used for labeling the
  // tab and internally in the program); if not return an error message.
    var patent_url = ""; patentLabel = ""; var error = "";
    var enteredPatent = inputText.toUpperCase();
    enteredPatent = enteredPatent.replace(/\s/g, "");                // get rid of all whitespace
    if (enteredPatent.search(/[\W_]/) != -1) {                       // if any non alphanumeric characters
       // prompt for valid patent
    }
    var match = rExpPat.exec(enteredPatent);
    if (match) {                                                     // if has the form of a patent
      var fullMatch = match[0];
      var cc = match[1]; var pref = match[2]; var num = match[3]; var post = match[4]; var kc = match[5];
      if (cc in patForm) {                                           // if valid country code
        var cObj = patForm[cc];
        checkKC();
        // user appended a valid kind code or no kind code; user entered a valid prefix or no prefix; user entered a
        // valid postfix or no postfix
        if (hasValidKindCode(kc, cObj)) {
          if (hasValidPrefPost(pref, kc, cObj, "pref")) {
            if (hasValidPrefPost(post, kc, cObj, "post")) {
              patent_url = "/patents/" + fullMatch;                  // patent number entry has valid format
              patentLabel = makePatentLabel(fullMatch);              // omit kind code from the label for the patent tab
              checkGooglePatent(patent_url, on_check_patent_url_complete);          
              return;
            }
            else {
              error = "Please try again"           // postfix code is not valid for this country
            }
          }
          else {
            error = "Please try again"             // prefix code not valid for this country
          }
        }
        else {
          error = "Please try again"               // kind code is not valid for this country
        }  
      }
      else {
        error = "Invalid country code"                               // country code appears to be invalid
      }
    }
    else {
      error = "Please try again"                   // prompt for valid patent number
    }
    on_patent_validated({"url": "", "label": "", "error": error});

    function on_check_patent_url_complete(respObject) {
    // callback for checkGooglePatent
      debug("In patentPicker, checkGooglePatent response is ", respObject);
      if (!respObject.error) {
        on_patent_validated({"url": patent_url, "label": patentLabel, "error": ""});
      }
      else {
        on_patent_validated({"url": "", "label": "", "error": "Patent not found"});
      }            
    }

    function checkKC() {
      if (!kc && post) {                           // if parsed no kind code, but parsed a post
        if (cObj.post) {                           // if country has postfixes
          for (kc_post in cObj.post) {             // for each kind code that allows a postfix
            // if post is legitimate for any kind code, assume it is meant to be a post
            if (cObj.post[kc_post].indexOf(post) != -1) return;
          }
        }
        // assume the parsed post is actually the kind code if postfixes are not allowed or if postfixes are allowed
        // but the post is not a legitimate postfix for any kind code.
        kc = post;
        post = "";
      }
    }

    function hasValidKindCode(kc, cObj) {
      if (!kc) return true;
      return (cObj.kc.indexOf(kc) != -1) ? true: false;
    }

    function hasValidPrefPost(value, kc, cObj, type) {
      if (!value) return true;                                   // if user entered no pre-/post-fix
      if (cObj[type]) {                                          // if country has pre-/post-fixes in some patent numbers
        if (!kc) return true;                                    // assume valid if no kind code to check against
        if (kc in cObj[type]) {                                  // if this kind code can have a patent number pre-/post-fix
          return (cObj[type][kc].indexOf(value) != -1) ? true: false; // if pre-/post-fix value is in list for this kind code
        }
        else {                                                   // has pre-/post-fix, but this kind code never has one
          return false;
        }
      }
      else {                                                     // has pre-/post-fix, but country's patents cannot have one
        return false;
      }
    }
  }

  this.getPatent = function(patent_url, patentLabel, on_get_patent_complete) {
  // make a patent tab labeled patentLabel, and map the patent; on_get_patent_complete is the callback;
  // patent_url must be a valid Google patent url for a patent in the Google database (use this.validatePatent).
    taskTracker.initialize("Fetching patent", undefined);
    taskTracker.startTask(1);
    // note that patent_url does not necessarily match the url that Google would use for a link to the patent.
    debug("In patentPicker, getting Google patent url " + patent_url +
          " and making a patent tab labeled " + patentLabel);

    patentTab(patent_url, patentLabel, on_patent_tab_complete);    // with getting the patent and creating a tab for it

    function on_patent_tab_complete(patent_no) {
    // callback called from patentTab with patent_no parsed from the Google patent document
      taskTracker.finishTask(1);
      toggleButton(patent_no, "btn-map-add", "add");
      addMapPatent(patent_no, "map", onMapComplete);
    }

    function onMapComplete() {
      setUndoButtonState();
      setClearButtonState();
      if (on_get_patent_complete) {
        on_get_patent_complete(patentLabel);
      }
    }
  }

  this.showError = function(error) {
    $("div.patent-input-error").addClass("make-displayed").text(error);   // show error message
    $("input.input-patent").focus();
    $("input.input-patent").select();
  }

  this.clearError = function() {
    $("div.patent-input-error").removeClass("make-displayed").text("");   // clear error message
  }

  var patForm = {
    "AP" : {"kc": ["A", "D0"]},
    "AR" : {"kc": ["A1", "A2", "A3", "A4", "A6", "Q"]},
    "AT" : {"kc": ["A", "A1", "A2", "A3", "A4", "A5", "A8", "A9", "B", "B1", "B2", "B8", "B9", "D", "T",
            "U1", "U2", "U3", "U8", "U9"], "pref": {"A": ["A"]}},
    "AU" : {"kc": ["A", "A1", "A2", "A3", "A4", "A5", "A6", "A8", "A9", "B", "B1", "B2", "B3", "B4", "B8",
            "B9", "C", "C1", "C4", "C8", "C9", "D0", "S"], "pref": {"D0": ["PN", "PM", "PO", "PP", "PA", "PR", "PW"]}},
    "BA": {"kc": ["A", "B1", "D"]},
    "BE": {"kc": ["A", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "B3", "B5", "B6", "D", "T1", "T2"]},
    "BG": {"kc": ["A", "A1", "A2", "A3", "A4", "B1", "B2", "U", "U1", "Y1", "Y2"]},
    "BR": {"kc": ["A", "A2", "A8", "B", "B1", "B8", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "D0", "E2",
           "F1", "K1", "S", "S1", "U", "U2", "Y1", "Y8"],
           "pref": {"A": ["PI"], "A2": ["PI"], "A8": ["PI"], "B": ["PI"], "B1": ["PI"], "B8": ["PI"],
                   "C1": ["PI"], "C2": ["PI"], "C3": ["PI"], "C4": ["PI"], "C5": ["PI"], "C6": ["PI"],
                   "C7": ["PI"], "C8": ["PI"], "E2": ["PI"], "F1": ["PI"], "S": ["D"], "U": ["MU"],
                   "U2": ["MU"], "Y1": ["MU"], "Y8": ["MU"]}},
    "BY": {"kc": ["C1", "U"]},
    "CA": {"kc": ["A", "A1", "A2", "B", "C", "C2", "E", "F", "S"]},
    "CH": {"kc": ["A", "A1", "A2", "A3", "A4", "A5", "A8", "A9", "B", "B1", "B5", "B8", "B9", "C1", "C2", "C3",
           "C9", "D", "E", "H1", "H2", "H3", "H9"], "post": {"A3": ["G"]}},
    "CL": {"kc": ["A1", "B", "S1", "U", "Y"]},
    "CN": {"kc": ["A", "B", "C", "K1", "K2", "K3", "K4", "K5", "S", "U", "Y"]},
    "CO": {"kc": ["A1", "A2", "U", "U1"]},
    "CR": {"kc": ["A", "S", "U"]},
    "CS": {"kc": ["A", "A1", "A2", "B1", "B2", "B3", "B4", "B5", "B6", "C"]},
    "CU": {"kc": ["A", "A1", "A2", "A3", "A5", "A6", "A7", "B6", "B7", "L"]},
    "CY": {"kc": ["A", "B1", "B2", "T1"]},
    "CZ": {"kc": ["A3", "B6", "U1"]},
    "DD": {"kc": ["A", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "B", "B1", "B2", "B3", "B5", "C2",
           "C4", "C5", "T1", "U"]},
    "DE": {"kc": ["A", "A1", "A5", "A8", "A9", "B", "B1", "B2", "B3", "B4", "B8", "B9", "C", "C1", "C2", "C3",
           "C4", "C5", "C8", "C9", "D1", "D2", "I1", "I2", "T", "T1", "T2", "T3", "T4", "T5", "T8", "T9",
           "U", "U1", "U8", "U9"]},
    "DK": {"kc": ["A", "B", "B1", "B2", "B3", "C", "D0", "K1", "L", "T1", "T3", "T4", "T5", "U1", "U3", "U4", "Y3",
           "Y4", "Y5", "Y6", "Z6"]},
    "DO": {"kc": ["A", "S", "U"], "pref": {"A": ["P"], "S": ["S"], "U": ["U"]}},
    "DZ": {"kc": ["A1"]},
    "EA": {"kc": ["A1", "A2", "A3", "A8", "B1", "B2", "B8", "B9"]},
    "EC": {"kc": ["A", "S", "U"], "pref": {"A": ["SP"], "S": ["SDI"], "U": ["SM", "SMU"]}},
    "EE": {"kc": ["A", "B1", "U1"]},
    "EG": {"kc": ["A"]},
    "EP": {"kc": ["A1", "A2", "A3", "A4", "A8", "A9", "B1", "B2", "B3", "B8", "B9"]},
    "ES": {"kc": ["A1", "A2", "A3", "A4", "A6", "A8", "A9", "B1", "B2", "B3", "B8", "B9", "D", "D0", "H1", "H3",
           "K1", "R", "R1", "R2", "T1", "T2", "T3", "T4", "T5", "T7", "T8", "T9", "U", "U4", "U8", "U9",
           "X1", "X3", "Y", "Y4"]},
    "FI": {"kc": ["A", "A0", "A1", "A7", "B", "B1", "B2", "B3", "C", "L", "U0", "U1"]},
    "FR": {"kc": ["A", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "B", "B1", "B2", "B3", "B4", "E", "F", "M", "T"]},
    "GB": {"kc": ["A", "A8", "A9", "B", "B8", "C", "C2", "D0"]},
    "GC": {"kc": ["A"]},
    "GE": {"kc": ["A", "B", "U", "Y"], "pref": {"A": ["AP"], "B": ["P", "AP"], "U": ["U", "AU"], "Y": ["U"]}},
    "GR": {"kc": ["A", "A1", "A7", "B", "B1", "B2", "T1", "T3", "T7", "U", "Y"]},
    "GT": {"kc": ["A", "S", "U"], "post": {"A": ["A", "B", "C"]}},
    "HK": {"kc": ["A", "A1", "A2"]},
    "HN": {"kc": ["A", "S1", "U"]},
    "HR": {"kc": ["A2", "A8", "A9", "B1", "B3", "B4", "B8", "B9", "C1", "T1", "T2", "T3", "T4", "T5", "T8"],
           "pref": {"A2": ["P"], "A8": ["P"], "A9": ["P"], "B1": ["P", "PK"], "B3": ["PK"], "B4": ["PK"], "B8": ["P"],
                    "B9": ["P"], "C1": ["P"], "T1": ["P"], "T2": ["P"], "T3": ["P"], "T4": ["P"], "T5": ["P"], "T8": ["P"]}},
    "HU": {"kc": ["A", "A1", "A2", "A3", "A9", "B", "B1", "D0", "U", "V0"], "pref": {"A": ["H", "T"]}},
    "ID": {"kc": ["A", "B", "S"]},
    "IE": {"kc": ["A1", "A2", "B1", "B2", "L"], "pref": {"A2": ["S"], "B2": ["S"], "L": ["S"]}},
    "IL": {"kc": ["A", "D0"]},
    "IN": {"kc": ["A1", "E"]},
    "IS": {"kc": ["A", "A7", "B", "B2", "B3", "B6"]},
    "IT": {"kc": ["A", "A1", "A3", "A4", "B", "B1", "D0", "T1", "T2", "T3", "U1", "U3", "U4", "V0", "Y1", "Z2"],
           "pref": {"A1": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "A3": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "A4": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "DO": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "T1": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "T2": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "T3": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "U1": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "U3": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "U4": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "V0": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"],
                    "Y1": ["BO", "SS", "GO", "VI", "AN", "AP", "AR", "PA", "UD", "LE", "TO", "MI", "WX", "VT", "AG",
                           "MI", "AL", "VV", "VR", "AQ", "SV", "PS", "PD", "NA", "SA", "CS", "GE", "TP", "IS", "FI",
                           "BG", "VC", "BS", "PG"]}},
    "JO": {"kc": ["B"]},
    "JP": {"kc": ["A", "A1", "B", "B1", "B2", "C1", "C2", "K1", "K2", "K4", "K5", "S", "U", "U3", "Y1", "Y2", "Z1", "Z2"],
           "pref": {"A": ["S", "H"], "A1": ["WO"], "B1": ["S", "H"], "B2": ["S", "H"], "K1": ["S", "H"], "K2": ["S", "H"],
                   "K4": ["S", "H"], "K5": ["S", "H"], "U": ["S", "H"], "Y1": ["S", "H"], "Y2": ["S", "H"]}},
    "KE": {"kc": ["A", "D"]},
    "KR": {"kc": ["A", "B1", "K1", "K2", "S", "U", "Y1"]},
    "KZ": {"kc": ["A", "B"]},
    "LT": {"kc": ["A", "B", "R3"]},
    "LU": {"kc": ["A", "A1", "A2", "A7", "D", "I2"]},
    "LV": {"kc": ["A", "A3", "A4", "B", "B4"]},
    "MA": {"kc": ["A1", "B1"]},
    "MC": {"kc": ["A", "E"]},
    "MD": {"kc": ["A", "A0", "A1", "A2", "A3", "B1", "B2", "C1", "C2", "E", "F1", "F2", "F3", "G2", "U", "W1", "W2", "Y",
           "Y1", "Y2", "Z", "Z2"]},
    "ME": {"kc": ["A"]},
    "MN": {"kc": ["A6"]},
    "MT": {"kc": ["A"], "pref": {"A": ["P"]}},
    "MW": {"kc": ["A1"]},
    "MX": {"kc": ["A", "B", "E"], "pref": {"A": ["PA", "YU", "GT", "JL", "NL"]}},
    "MY": {"kc": ["A", "U"]},
    "NI": {"kc": ["A"]},
    "NL": {"kc": ["A", "A1", "B", "C", "C1", "C2", "C8", "I1", "I2", "T"]},
    "NO": {"kc": ["A", "B", "B1", "B2", "B3", "C", "D0", "I1", "I2", "L"]},
    "NZ": {"kc": ["A"]},
    "OA": {"kc": ["A", "E"]},
    "PA": {"kc": ["A1", "A2"]},
    "PE": {"kc": ["A1", "Z"]},
    "PH": {"kc": ["A", "U"]},
    "PL": {"kc": ["A1", "A2", "A3", "A4", "A5", "A6", "B1", "B2", "B3", "B4", "T3", "U1", "U3", "Y1", "Y3"]},
    "PT": {"kc": ["A", "A1", "B", "B1", "D", "E", "T", "U", "W", "Y"]},
    "RO": {"kc": ["A", "A0", "A1", "A2", "A3", "A7", "A8", "B", "B1", "B2", "B8", "B9", "C1", "U1", "U2", "U8"]},
    "RS": {"kc": ["A", "A1", "A2", "A3", "B", "U"]},
    "RU": {"kc": ["A", "A8", "C", "C1", "C2", "C8", "C9", "K1", "K3", "S", "U1", "U8"]},
    "SE": {"kc": ["A", "A0", "A1", "A2", "B", "C", "C1", "C2", "C3", "C5", "C8", "D0", "E", "E5", "K3", "L"]},
    "SG": {"kc": ["A1", "A2", "G"]},
    "SI": {"kc": ["A", "A1", "A2", "A8", "B", "T1", "T2"]},
    "SK": {"kc": ["A3", "B6", "U1", "Y1", "Y2"]},
    "SM": {"kc": ["A", "B", "S", "S1", "S2", "S3", "S4"], "pref": {"A": ["AP"], "B": ["P", "T"], "S4": ["C"]}},
    "SU": {"kc": ["A", "A1", "A2", "A3", "A4", "K1", "T"]},
    "SV": {"kc": ["A"]},
    "TH": {"kc": ["A"]},
    "TJ": {"kc": ["A", "B", "R3", "U", "Y3"]},
    "TR": {"kc": ["A", "A1", "A2", "A3", "T1", "T2", "T3", "T4", "U", "U1", "U2", "Y"]},
    "TT": {"kc": ["B"]},
    "TW": {"kc": ["A", "B", "K1", "K2", "S", "U"], "pref": {"B": ["I"], "K2": ["I"], "S": ["D"], "U": ["M"]}},
    "UA": {"kc": ["A", "A1", "C2", "U"]},
    "US": {"kc": ["A", "A1", "A2", "A9", "B", "B1", "B2", "B3", "C1", "C2", "E", "E1", "F1", "F2", "H", "H1", "I1", "I3",
           "I4", "I5", "P", "P1", "P2", "P3", "S", "S1"],
           "pref": {"E": ["RE"], "E1": ["RE"], "F1": ["RE"], "H": ["H"], "H1": ["H"], "I1": ["X"], "I3": ["AI"],
                    "I4": ["T"], "I5": ["B"], "S": ["D"], "S1": ["D"]}},
    "UY": {"kc": ["A", "A1", "A2", "A3", "Q", "U"]},
    "UZ": {"kc": ["B"]},
    "VN": {"kc": ["A1", "A6", "U"]},
    "WO": {"kc": ["A1", "A2", "A3", "A4", "A8", "A9", "B1", "B8", "K1"]},
    "YU": {"kc": ["A", "B", "U"], "pref": {"A": ["P"], "U": ["MP"]}},
    "ZA": {"kc": ["A", "D"]},
    "ZM": {"kc": ["A1", "D"]},
    "ZW": {"kc": ["A1"]}
  }
}

function RandomPatentPicker() {
// object to choose and plot a randomly select US patent on the force map; callback argument for
// .mapRandomPatent is an optional callback.
  this.maxTries = 20;

  this.initialize = function() {
    taskTracker.initialize("Finding random patent", undefined);
    taskTracker.startTask(1);
  }

  this.mapRandomPatent = function(on_map_random_complete) {
  // generate a random US patent number and map it; call optional callback when done
    this.initialize();
    var reTries = 0;
    var patentLabel = "";
    var patent_url = "";
    USpatent = getRandomPatentNo();                    // get a random US patent number without the kind code
    if (USpatent) {
      taskTracker.startTask(1);
      patent_url = "/patents/" + USpatent;
      checkGooglePatent(patent_url, on_check_patent_url_complete.bind(this));          
    }
    else {
      debug("In randomPatentPicker, could not find a patent that was not already mapped!"); 
    }

    function on_check_patent_url_complete(respObject) {
    // if patent_no exists in Google database, proceed with creating the tab and mapping the patent; if not
    // try again with a different random patent number.
      taskTracker.finishTask(1);
      if (!respObject.error) {
        patentLabel = makePatentLabel(USpatent);
        patentTab(patent_url, patentLabel, on_patent_tab_complete);
      }
      else {
        if (reTries < this.maxTries) {
          debug("In randomPatentPicker, retry " + reTries);
          reTries += 1;
          this.mapRandomPatent(on_map_random_complete);
        }
        else {
          debug("In randomPatentPicker, max retries " + this.maxTries + " exceeded. Exiting...");
        }
      }
    }

    function on_patent_tab_complete(patent_no) {
    // callback called from patentTab with patent_no parsed from the Google patent document
      taskTracker.finishTask(1);
      toggleButton(patent_no, "btn-map-add", "add");
      addMapPatent(patent_no, "map", onMapComplete);
    }

    function onMapComplete() {
      setUndoButtonState();
      setClearButtonState();
      if (on_map_random_complete) {
        on_map_random_complete(patentLabel);
      }
    }

    function getRandomPatentNo() {
      for (var i = 0; i < 20; i++) {
        var random_no = patentRange.min + Math.floor((patentRange.max - patentRange.min + 1)*Math.random());
        var randomUS = "US" + random_no;
        var alreadyMapped = false;
        var mapList = (patentLists["map"].length > 0) ? patentLists["map"]: patentLists["cleared"]["map"];
        for (iPat = 0; iPat < mapList.length; iPat++) {
          var patent_no = mapList[iPat];                         // the full Google patent document patent number
          if (makePatentLabel(patent_no) == makePatentLabel(randomUS)) {
            alreadyMapped = true;
            break;
          }
        }
        if (!alreadyMapped) {
          return randomUS;
        }
      }
      return undefined;
    }
  }
}

function checkGooglePatent(patent_url, on_head_request_complete) {
// make a HEAD request to Google for /patents/patent_no to find out if it has data for patent_no;
// if patent_url is valid, call callback on_head_request_complete with object containing the data and the textStatus
// if server returns an error, callback with object containing the jqXHR object and the errorThrown message;
// called from patentPicker.validatePatent, randomPatentPicker.mapRandomPatent, and on_click_fun_btn,
  $.cookie("yappee_cl", clientCookie);                     // set clientCookie
  $.ajax({ type: "HEAD",
           url: patent_url,
           contentType: "application/x-www-form-urlencoded; charset=UTF-8",    // this is default
           success: function(data, textStatus, jqXHR) {
                    // for a HEAD request, a valid url returns an empty 'data' object, always check for errors
                    // by checking errorThrown in the callback for the error: case
                      on_head_request_complete({data: data, status: textStatus});
                    },
           error: function(jqXHR, textStatus, errorThrown) {
                    debug("In checkGooglePatent, error returned from HEAD request: '" + errorThrown + "'", jqXHR);
                    on_head_request_complete({status: textStatus, error: errorThrown});
                  }
         });
  $.removeCookie("yappee_cl");                              // remove clientCookie
}

