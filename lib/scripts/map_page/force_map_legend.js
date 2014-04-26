// javascript for assignee legend on the force map

      // legend parameters
      var nLegendEntry = 8;                      // maximum number of legend entries
      var nLegendColors = 12;                    // maximum number of legend colors, including dedicated color for 'AllOtehrs' entry

      var legendEntries = [];                        // array of LegendEntry legend entry objects that can be sorted by patentCount
      var plottedLegendEntries = [];                 // the array of LegendEntry objects that are shown in the legend
      var legendObjects = {};                              // need a key-value collection of LegendEntry objects

      function LegendEntry(assignee, legendColor, patentCount) {  // constructor for a LegendEntry instance
        this.assignee = assignee;
        this.legendColor = legendColor;
        this.patentCount = patentCount;
      }

      function updateSymbols() {
        allPatentNodes = svg.selectAll("g.node");
        allPatentNodes.each(updateForceMapSymbolColor);
      }

      function updateForceMapSymbolColor(d, i) {
        var legendKey = d.biblio.shortAssignee;
        var legendObject = legendObjects[legendKey];
        var legendIndex = plottedLegendEntries.indexOf(legendObject);
        var legendColor = (legendIndex != -1) ? legendObject.legendColor : legendObjects["AllOthers"].legendColor;
        d3.select(this).selectAll("circle.force-patent-circle, circle.force-mapped-circle, circle.force-favorite-circle")
              .style({"fill": legendColor});        
      }

      function updateLegend() {
      // called from updateForceMap, deletePatentFromMap, removePatentFromMapped
        // determine if we need to have an 'AllOthers' entry in the legend; add a LegendEntry object if needed; always use
        // legendColors[0] for the color of 'AllOthers' if needed
        if (legendEntries.length > nLegendEntry) {            // need to create the 'AllOthers' entry
          if (!legendObjects["AllOthers"]) {
            legendObjects["AllOthers"] = new LegendEntry("Others", legendColors[0], 0);      // always use legendColors[0]
          }
          legendObjects["AllOthers"].patentCount = 0;
          for (var iL = nLegendEntry - 1; iL < legendEntries.length - 1; iL++) {   // the last entry is 'Others' at this point
            var notShownEntry = legendEntries[iL]
            legendObjects["AllOthers"].patentCount += notShownEntry.patentCount;
          }
          plottedLegendEntries = legendEntries.slice(0, nLegendEntry - 1).concat([legendObjects["AllOthers"]]);
        }
        else {
          plottedLegendEntries = legendEntries.slice(0, nLegendEntry);
        }

        // now update the SVG for the legend
        legend.select("rect.legend-frame").remove();
        // show only the first nLegendEntry entries
        var curLegendItem = legend.selectAll("g.legend-entry").data(plottedLegendEntries);
        curLegendItem.select("circle.legend-symbol");                             // propagate the new data to the child elements!
        curLegendItem.select("text.legend-text");
        var newLegendItem = curLegendItem.enter().append("svg:g").classed({"legend-entry": true});     // add new legend entries
        newLegendItem.append("svg:circle").classed({"legend-symbol": true}).attr({"r": 5});
        newLegendItem.append("svg:text").classed({"legend-text": true});
        curLegendItem.exit().remove();
        curLegendItem = legend.selectAll("g.legend-entry");                                 // refresh the data for the legend SVG
        curLegendItem.attr({"transform": function(d, i) {return "translate(0," + i*14 + ")";}});       // list the entries
        curLegendItem.selectAll("circle.legend-symbol")
                            .style({"fill": function(d, i) {return d.legendColor;}});
        curLegendItem.selectAll("text.legend-text").attr({"transform": "translate(15,0)", "dominant-baseline": "middle"})
                            .text(function(d, i) {return d.assignee + " (" + d.patentCount + ")";});
        if (legendEntries.length > 0) {
          var bBox = legend.node().getBBox();                          // get bounding box of an SVG element
          legend.insert("svg:rect", ":first-child").classed({"legend-frame": true})             // first element in g
                       .attr({"x": "-12", "y": "-12", "width": bBox.width + 13, "height": bBox.height + 9});
        }
      }

      function recycleLegendColor(legendEntry) {
      // puts legendEntry.legendColor back in the list of available colors; called from deletePNode and updateLegend.
        legendColors.push(legendEntry.legendColor);                  // add to end of color list
        legendEntry.legendColor = "";
      }

      function getNewLegendColor(legendEntry) {
      // assigns an unused legend color to legendEntry.legendColor
        legendEntry.legendColor = legendColors.pop();                          // pop from end of color list
      }

      function addToLegend(patentNode) {
      // add the patent represented by patentNode to the legend; called from addPatentToPlottingLists
        var assignee = patentNode.biblio.assignee;
        var shortAssignee = patentNode.biblio.shortAssignee;
        var legendEntry = legendObjects[shortAssignee];
        if (!legendEntry)  {                 // add object for this assignee to legendObjects and add to the legendEntries array
          legendEntry = new LegendEntry(assignee, "", 0);
          legendObjects[shortAssignee] = legendEntry;
          legendEntries.push(legendEntry);
        }
        legendEntry.patentCount +=1;
        legendEntries.sort(legendSort);
        var curEntryIndex = legendEntries.indexOf(legendEntry);
        if (curEntryIndex <= nLegendColors - 1 && legendEntry.legendColor == "") {   // we need to assign a legend color
          if (legendColors.length > 1) {
            getNewLegendColor(legendEntry);
          }
          // take color of the nLegendColor'th entry; (one legendColor is always reserved for the 'AllOthers' entry)
          else {
            var lastColoredEntry = legendEntries[nLegendColors-1];
            legendEntry.legendColor = lastColoredEntry.legendColor;
            lastColoredEntry.legendColor = "";
          }
        }
      }

      function deleteFromLegend(patentNode) {
      // delete the patent represented by patentNode from the legend; called from deletePNode.
        var shortAssignee = patentNode.biblio.shortAssignee;
        var legendEntry = legendObjects[shortAssignee];
        legendEntry.patentCount -= 1;
        legendEntries.sort(legendSort);
        var curEntryIndex = legendEntries.indexOf(legendEntry);
        if (curEntryIndex > nLegendColors - 2 && legendEntry.legendColor != "") {   // we need to give the color to another entry
          var lastLegendEntry = legendEntries[nLegendColors - 2]
          lastLegendEntry.legendColor = legendEntry.legendColor;
          legendEntry.legendColor = "";
        }
        if (legendEntry.patentCount == 0) {                             // if no other patents from this company
          legendEntries.splice(curEntryIndex, 1);                       // delete assignee from the legendEntries
          if (legendEntry.legendColor != "") {
            recycleLegendColor(legendEntry);          
          }
          delete legendObjects[shortAssignee];                            // and from the legendObjects collection
        }
      }

      function legendSort(a, b) {
      // sorting function for legendEntries
        if (a.patentCount < b.patentCount) return 1;      // sort in descending order of count
        if (a.patentCount > b.patentCount) return -1;
        // if patentCount is the same:
        // put 'Assignee not available' last
        if (a.assignee == "Assignee not available") return 1;
        if (b.assignee == "Assignee not available") return -1;
        if (a.assignee > b.assignee) return 1;            // sort in ascending alphabetic order
        if (a.assignee < b.assignee) return -1;
        return 0;
      }
