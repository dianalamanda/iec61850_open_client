var nodes, edges, network, socket, svgRoot, svgElementData;

$(document).ready(function() {
  svgRoot = null;
  namespace = '';
  socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

  //register data for svg
  var mmi = document.getElementById("mmi_svg");
  //it's important to add an load event listener to the object, as it will load the svg doc asynchronously
  //but sometimes the svg loads before this event listener is created
  if(mmi.getSVGDocument() == null){//normal situation where svg is loaded later
    mmi.addEventListener("load",function(){ 
      svg_load(mmi); 
    },false);
  }
  else {//race condition, where svg is allready loaded from cache
    svg_load(mmi);
  }
  

	//add tabs
	$("#hostlogtab").dynatabs({
		tabBodyID : "hostlogbody",
		showCloseBtn : true,
	});
  var tabje = $("#localhost_tab")[0];
  tabje.children[0].classList.remove("closeable");

  /* register events from server */
  //add info to the ied/datamodel tab
  socket.on('info_event', function (data) {
    //event gets called from server when info data is updated, so update the info tab
    //write data
    $('#datamodel')[0].innerHTML = data;
    $("#CurrentIEDModel tr").click(writeValueModel);//regiser click event for dialog
  });

  //add info to the ied/datamodel tab
  socket.on('svg_value_update_event', function (data) {
    //event gets called from server when svg data is updated, so update the svg
    var element = data['element'];
    var value = data['data']['value'];
    var type = data['data']['type'];

    if(svgRoot != null){//if the svg is loaded
      //check for each occurence of id, there can be multiple instances of the same id, with different classes
      $("#" + $.escapeSelector(element),svgRoot).each(function(idx, el){
        var cl = el.classList.toString();


        if( cl == "MEAS"){
          if(el.dataset.size > 0 || typeof(el.dataset.text) === "undefined"){
            var desc = el.innerHTML;
            el.textContent = value;
          }
          else{
            el.textContent = el.dataset.text.replace("{value}",value);
          }

        }
        if(cl == "XCBR" || cl == "XSWI"){
          if(type == 'boolean'){
            if(value=='True'){
              if(svgElementData[el.id]['position'] != true) {
                $("#open",el)[0].beginElement();
                svgElementData[el.id]['position'] = true;

                var ref = el.id;
                var sibling = $(el).siblings(".CSWI");//find a CSWI sibling, and operate on that instead
                if(sibling.length > 0){
                  ref = sibling[0].id;
                }
                svgElementData[ref]['position'] = true;
              }
            }
            else{
              if(svgElementData[el.id]['position'] != false){
                $("#close",el)[0].beginElement();
                svgElementData[el.id]['position'] = false;

                var ref = el.id;
                var sibling = $(el).siblings(".CSWI");//find a CSWI sibling, and operate on that instead
                if(sibling.length > 0){
                  ref = sibling[0].id;
                }
                svgElementData[ref]['position'] = false;
              }
            }
          }
          if(type == 'bit-string'){
            if(value == '1'){
              if(svgElementData[el.id]['position'] != false) {
                $("#close",el)[0].beginElement();
                svgElementData[el.id]['position'] = false;

                var ref = el.id;
                var sibling = $(el).siblings(".CSWI");//find a CSWI sibling, and operate on that instead
                if(sibling.length > 0){
                  ref = sibling[0].id;
                }
                svgElementData[ref]['position'] = false;
              }
            }
            else if(value == '2'){
              if(svgElementData[el.id]['position'] != true){
                $("#open",el)[0].beginElement();
                svgElementData[el.id]['position'] = true;

                var ref = el.id;
                var sibling = $(el).siblings(".CSWI");//find a CSWI sibling, and operate on that instead
                if(sibling.length > 0){
                  ref = sibling[0].id;
                }
                svgElementData[ref]['position'] = true;
              }
            }
            else if(value == '0'){
              $("#transition",el)[0].beginElement();
            }
            else{
              $("#error",el)[0].beginElement();
            }
          }
        }
      })
    }
  });

  //send by server when a log-line should be added to a tab
  //if the tab did not exist yet, create it
  socket.on('log_event', function (data) {
    //event gets called from server when new log events are generated, and add them to the log tab
    //if clear is set, all log data is cleared before adding the new data
    if($("#" + $.escapeSelector(data['host']) + "_tab").length == 0) {
      //addNode(data['host'], '1');
      addNewStaticTab(data['host']);
    }

    var ahref = $("#" + $.escapeSelector(data['host']) + "_tab")[0];
    var key = $(ahref).attr('href');
    if(data['clear'] == '1') {
      $(key)[0].innerHTML = "<pre>" + data['data'] + "</pre>";  
    }
    else {
      $(key)[0].innerHTML += "<pre>" + data['data'] + "</pre>";
    }
    //scroll to bottom
    var element = $("#hostlogbody")[0];
    element.scrollTop = element.scrollHeight;
  });

  //send by server when a different logging tab should be selected
  socket.on('select_tab_event', function (data) {
    //event gets called from server when the tab-focus should be changed
    var tab = $('#hostlogtab.tabs');
    var ahref;
    if(data['host_index']){
      var integer = parseInt(data['host_index'], 10);
      ahref = $('#hostlogtab.tabs')[0].children[integer].children[0];
    }
    else if(data['host_name']){
      ahref = $("#" + $.escapeSelector(data['host_name']) + "_tab")[0];
    }
    selectTabByHref(tab, ahref);
  });

  socket.on('page_reload', function (data) {
    location.reload();
  });
});

/********************************************************/
/*             socket.io calls               */
/********************************************************/

/* emit from client to server */

function get_page_data() {
  socket.emit('get_page_data', {data: ''});
  //call server to tell we want all data, so we can fill the ui (normally done once on full page load/refresh)
}


/********************************************************/
/*                        UI calls                      */
/********************************************************/

//add loggin tab based on hostname
function addNewStaticTab(host)
{
  var ret = 0;
  if($("#" + $.escapeSelector(host) + "_tab").length > 0) {
    console.log("tab exists");
    return 1;//tab exists
  }

  $.addDynaTab({
    tabID : 'hostlogtab',
    type : 'html',
    html : '<pre>[+] logging started</pre>',
    tabTitle : host
  });

  //add hostname to button-id
  try {
    var len = $('#hostlogtab.tabs')[0].children.length;
    var ahref = $('#hostlogtab.tabs')[0].children[len-1].children[0];
    ahref.id = host + "_tab";

    //add additional callback
    $("#" + $.escapeSelector(host) + "_tab").bind('click',{ ahref: ahref, tab: ahref.id, host: host}, myTabClick );	
  }
  catch (err) {
    console.log(err);
    ret = -1;
  }

  return ret;
}

//set focus when a tab is clicked
function myTabClick(event)
{
  socket.emit('set_focus', event.data.host);
}

//select the tab based on the hostname
function selectTabByHref(tab, ahref)
{
  var ret = 0;
  try {
    var event = $.Event("click");
    event.data = {ahref:"",tab:""};
    event.data.ahref = ahref;
    event.data.tab = tab;
    $("#hostlogtab").showTab(event);
  }
  catch (err) {
    console.log(err);
    ret = -1;
  }
  return ret;
}


/* svg calls */
function svg_load(mmi){
  var svgDoc = mmi.contentDocument; //get the inner DOM of mmi.svg
  svgRoot  = svgDoc.documentElement;
  svgElementData = {};

  //register for all values in loaded svg
  $("g",svgRoot).find("*").each(function(idx, el){
    //console.log("id:" + el.id );
    var cl = el.classList.toString();
    //elements that can be interacted with by the IEC61850 client
    if(el.id.startsWith("iec61850://") == true){    
      svgElementData[el.id] = {};
      if(cl == "XCBR"){
        socket.emit('register_datapoint', {id : el.id, class : cl});
        el.onclick = writePositionCSWI;
      }
      if(cl == "XSWI"){
        socket.emit('register_datapoint', {id : el.id, class : cl});
        el.onclick = writePositionCSWI;//register, to pass to CSWI element
      }
      if(cl == "CSWI"){
        //dont register datapoint
        el.onclick = writePosition;
        svgElementData[el.id]['position'] = true;
      }
      if(cl == "MEAS"){
        socket.emit('register_datapoint', {id : el.id, class : cl});
      }
    }
    //elements that can be modified by the simulation
    if(el.id.startsWith("simulation://") == true){
      if(cl == "LINE"){
        el.onclick = simulationPoint;
      }
      if(cl == "IFL"){
        el.onclick = writeValue;
      }
      if(cl == "LOAD"){
        el.onclick = writeValue;
      }
    }
  })
  socket.emit('register_datapoint_finished', '');
  // connect functions for reading/writing values and generating faults, that can socket.emit
}

function writeValue(event){
  alert('write a value');
  //generate write interface
  //socket.emit('write_value', { id : this.id, value : '10' });
}

function writeValueModel(event){
  var refid = this.id;//get the id of the first column
  var ref = $(this).children("td").html();
  var type = ref.substring(1, 3);

  if(type == "**"){
    alert("cannot write a structure");
    return;
  }
  writeDialog(refid, ref);
}

function simulationPoint(event){
  //generate call to create fault at this line
  console.log(this.id);
}

function writePosition(event){
  ref = this.id;
  operateDialog(ref);
}

function writePositionCSWI(event){
  //find a CSWI sibling, and operate on that instead
  var ref = this.id;

  var sibling = $(this).siblings(".CSWI");
  if(sibling.length > 0){
    ref = sibling[0].id;
  }
  operateDialog(ref);
}

function operateDialog(ref){
  //read element
  socket.emit("read_value", {id : ref  }, function(data, err){
    //read return
    if(err != 0){
      alert("could not read element:" + ref + " error:" + err);
      return;
    }
    var ctlModel = data['ctlModel']['value'];
    var orCat = data['Oper']['origin']['orCat']['value'];
    var orIdent = data['Oper']['origin']['orIdent']['value'];
    var ctlVal = false;
    if(ref in svgElementData && 'position' in svgElementData[ref]){
      if(svgElementData[ref]['position'] == true){
        ctlVal = false ;
      }
      else{
        ctlVal =true ;
      }
    } 
    //based on element type, create dialog (type: int, float, enum, bool?)
    //(drop-down for forcing a different ctlmodel?)
    content = '<form>';   
    content += '<div style="" ><b>Element: </b></div><br><div class="controlInput"><i>' + ref + '</i></div><br>'; //+ " : " + JSON.stringify(data);

    content += '<div style=""><label for="ctlVal"><b>CtlVal: (CtlModel: '+ ctlModel +')</b></label></div><br>';
    content += '<input  class="controlInput" id="ctlVal" type="text" value="'+ctlVal+'"/><br>';

    content += '<div style=""><label for="orCat"><b>orCat:</b></label></div><br>';
    content += '<input  class="controlInput" id="orCat" type="text" value="'+orCat+'"/><br>';
    content += '<div style=""><label for="orIdent"><b>orIdent:</b></label></div><br>';
    content += '<input  class="controlInput" id="orIdent" type="text" value="'+orIdent+'"/><br>';
    if (ctlModel == 2 || ctlModel == 4){
      content += '<br><button class="controlBtn" type="submit" id="select">Select</button><br>';
    }

    content += '<br><button class="controlBtn" type="submit" id="operate">Operate</button><br>';

    if (ctlModel == 2 || ctlModel == 4){
      content += '<br><button class="controlBtn" type="submit" id="cancel">Cancel</button><br>';
    }
    content += '</form>';

    var dialog = new top.PopLayer({ 
      "title": "Control model", 
      "content": content
    });

    dialog.myPop[0].addEventListener('submit', (event) => {
      event.preventDefault();
      // check input values
      var val = event.target['ctlVal'];
      var action = event.submitter.id;
      // submit write request

      if(action == 'operate'){
        socket.emit('operate', { id : ref, value : val.value }, function(err){
          if(err==1){
            dialog.destroy();
          }else{
            // show error
            alert("could not operate with error code:"+err);
          }
        });
      }
      if(action == 'select'){
        socket.emit('select', { id : ref, value : val.value }, function(err){
          if(err==1){
            alert(ref + " selected!");
          }else{
            // show error
            alert("could not select with error code:"+err);
          }
        });
      }
      if(action == 'cancel'){
        socket.emit('cancel', { id : ref }, function(err){
          if(err==1){
            dialog.destroy();
          }else{
            // show error
            alert("could not cancel with error code:"+err);
          }
        });
      }
    });
  });
}

function writeDialog(refid, ref){
  //read element
  socket.emit("read_value", {id : refid }, function(data, err){
    //read return
    if(err != 0){
      alert("could not read element:"+refid+" error:"+err);
      return;
    }
    //based on element type, create dialog (type: int, float, text, enum, bool, bitstring)
    //if ref endswith .Oper/.SBO/.SBOw,.Cancel, provide dialog based on ctlmodel (drop-down for forcing a different model?)
    content = '<form>';   
    content += '<div style="" ><b>Element: </b></div><br><div class="controlInput"><i>' + ref + '</i></div><br>'; //+ " : " + JSON.stringify(data);
    content += '<div style=""><label for="inp"><b>Value: ( type : '+ data['type'] +')</b></label></div><br>';
    content += '<input  class="controlInput" id="inp" type="text" value="'+data['value']+'"/><br>';
    content += '<br><button class="controlBtn" type="submit">Write</button><br>';
    content += '</form>';
    //$("#includedContent").load("b.html");
    var dialog = new top.PopLayer({ 
      "title": "Write Value", 
      "content": content
    });

    dialog.myPop[0].addEventListener('submit', (event) => {
      event.preventDefault();
      // check input values
      var val = event.target['inp'];
      // submit write request
      socket.emit('write_value', { id : refid, value : val.value }, function(err){
        if(err==0){
          dialog.destroy();
        }else{
          // show error
          alert("could not write value with error code:"+err);
        }
      });
    });
  });
}

function draw() {
  console.log("draw");
}

