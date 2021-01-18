import React, {useContext, useState, useCallback, useRef, useEffect} from 'react';
import { IsNavContext } from './Tool/NavPanel'
import axios from "axios";
import nanoid from 'nanoid';
import './util.css';


import {
  DropTargetsContext,
  WithDropTarget  
} from '../imports/DropTarget';
import Draggable from '../imports/Draggable';

import { BreadcrumbContext } from '../imports/Breadcrumb';

import {
  HashRouter as Router,
  Switch,
  Route,
  useHistory
} from "react-router-dom";

import {
  atom,
  atomFamily,
  selector,
  selectorFamily,
  RecoilRoot,
  useSetRecoilState,
  useRecoilValueLoadable,
  useRecoilStateLoadable,
  useRecoilState,
  useRecoilValue,
} from 'recoil';

const sortOptions = Object.freeze({
  "LABEL_ASC": "label ascending",
  "LABEL_DESC": "label descending",
  "CREATION_DATE_ASC": "creation date ascending",
  "CREATION_DATE_DESC": "creation date descending"
});

export const globalSelectedNodesAtom = atom({
  key:'globalSelectedNodesAtom',
  default:[]
})

const dragStateAtom = atom({
  key: 'dragStateAtom',
  default: {
    isDragging: false,
    draggedOverDriveId: null,
    isDraggedOverBreadcrumb: false
  }
})

let fetchDrivesQuery = selector({
  key:"fetchDrivesQuery",
  get: async ({get})=>{
    const { data } = await axios.get(
      `/api/loadAvailableDrives.php`
    );
    return data
  },
 
})

export default function Drive(props){
  console.log("=== Drive")
  const isNav = useContext(IsNavContext);

  const drivesAvailable = useRecoilValueLoadable(fetchDrivesQuery);
  if (drivesAvailable.state === "loading"){ return null;}
  if (drivesAvailable.state === "hasError"){ 
    console.error(drivesAvailable.contents)
    return null;}


  if (props.types){

    let drives = [];
    for (let type of props.types){
      for (let driveObj of drivesAvailable.contents.driveIdsAndLabels){
        if (driveObj.type === type){
          drives.push(
          <React.Fragment key={`drive${driveObj.driveId}${isNav}`} ><Router ><Switch>
           <Route path="/" render={(routeprops)=>
           <DriveRouted route={{...routeprops}} driveId={driveObj.driveId} label={driveObj.label} isNav={isNav} {...props} driveObj={driveObj}/>
           }></Route>
         </Switch></Router></React.Fragment>)
        }
      }
    }
    return <>{drives}</>
  }else if (props.driveId){
    for (let driveObj of drivesAvailable.contents.driveIdsAndLabels){
        if (driveObj.driveId === props.driveId){
         return <Router><Switch>
           <Route path="/" render={(routeprops)=>
           <DriveRouted route={{...routeprops}} driveId={driveObj.driveId} label={driveObj.label} isNav={isNav} {...props} driveObj={driveObj}/>
           }></Route>
         </Switch></Router>
        }
    }
    console.warn("Don't have a drive with driveId ",props.id)
    return null;
  }else{
    console.warn("Drive needs types or driveId defined.")
    return null;
  }
}

let loadDriveInfoQuery = selectorFamily({
  key:"loadDriveInfoQuery",
  get: (driveId) => async ({get,set})=>{
    const { data } = await axios.get(
      `/api/loadFolderContent.php?driveId=${driveId}&init=true`
    );
    // console.log("loadDriveInfoQuery DATA ",data)
    // let itemDictionary = {};
    //   for (let item of data.results){
    //     itemDictionary[item.itemId] = item;
    //   }
    //   data["itemDictionary"] = itemDictionary;
    return data;
  },
 
})

//Find BrowserId's given driveId
let browserIdDictionary = atomFamily({
  key:"browserIdDictionary",
  default:[]
})

let folderDictionary = atomFamily({
  key:"folderDictionary",
  default:selectorFamily({
    key:"folderDictionary/Default",
    get:(driveIdFolderId)=>({get})=>{
      const driveInfo = get(loadDriveInfoQuery(driveIdFolderId.driveId))
      // console.log(">>>driveInfo",driveInfo)
      let defaultOrder = [];
      let contentsDictionary = {};
      let folderInfo = {};
      for (let item of driveInfo.results){
        if (item.parentFolderId === driveIdFolderId.folderId){
          defaultOrder.push(item.itemId);
          contentsDictionary[item.itemId] = item;
        }
        if (item.itemId === driveIdFolderId.folderId){
          folderInfo = item;
        }
      }
  
      return {folderInfo,contentsDictionary,defaultOrder}
    } 
  })
})

export const folderDictionarySelector = selectorFamily({
  //{driveId,folderId}
  get:(driveIdFolderId)=>({get})=>{
    return get(folderDictionary(driveIdFolderId));
  },
  set: (driveIdFolderId) => async ({set,get},instructions)=>{
    const fInfo = get(folderDictionary(driveIdFolderId))
    switch(instructions.instructionType){
      case "addItem":
        const dt = new Date();
        const creationDate = `${
          dt.getFullYear().toString().padStart(2, '0')}-${
            (dt.getMonth()+1).toString().padStart(2, '0')}-${
            dt.getDate().toString().padStart(2, '0')} ${
          dt.getHours().toString().padStart(2, '0')}:${
          dt.getMinutes().toString().padStart(2, '0')}:${
          dt.getSeconds().toString().padStart(2, '0')}`
        const itemId = nanoid();
        const newItem = {
          assignmentId: null,
          branchId: null,
          contentId: null,
          creationDate,
          isPublished: "0",
          itemId,
          itemType: instructions.itemType,
          label: instructions.label,
          parentFolderId: driveIdFolderId.folderId,
          url: null,
          urlDescription: null,
          urlId: null
        }
        //TODO: update to use fInfo
        set(folderDictionary(driveIdFolderId),(old)=>{
        let newObj = {...old}
        newObj.contentsDictionary = {...old.contentsDictionary}
        newObj.contentsDictionary[itemId] = newItem;
        newObj.defaultOrder = [...old.defaultOrder];
        let index = newObj.defaultOrder.indexOf(instructions.selectedItemId);
        newObj.defaultOrder.splice(index+1,0,itemId);
        return newObj;
        })
        if (instructions.itemType === "Folder"){
          //If a folder set folderInfo and zero items
          set(folderDictionary({driveId:driveIdFolderId.driveId,folderId:itemId}),{
            folderInfo:newItem,contentsDictionary:{},defaultOrder:[]
          })
        }
        const data = { 
          driveId:driveIdFolderId.driveId,
          parentFolderId:driveIdFolderId.folderId,
          itemId,
          label:instructions.label,
          type:instructions.itemType
         };
        const payload = { params: data };

        axios.get('/api/AddItem.php', payload)
        .then(resp=>{
          console.log(">>>resp",resp)
          //Not sure how to handle errors when saving data yet
          // throw Error("made up error")
        })
      break;
      case "delete item":
        //Remove from folder
        let item = {driveId:driveIdFolderId.driveId,browserId:instructions.browserId,itemId:instructions.itemId}
        let newFInfo = {...fInfo}
        newFInfo["defaultOrder"] = [...fInfo.defaultOrder];
        newFInfo["contentsDictionary"] = {...fInfo.contentsDictionary}
        let index = newFInfo["defaultOrder"].indexOf(instructions.itemId);
        newFInfo["defaultOrder"].splice(index,1)
        delete newFInfo["contentsDictionary"][instructions.itemId];
        set(folderDictionary(driveIdFolderId),newFInfo);
        //Remove from selection
        if (get(selectedDriveItemsAtom(item))){
          set(selectedDriveItemsAtom(item),false)
          let newGlobalItems = [];
          for(let gItem of get(globalSelectedNodesAtom)){
            if (gItem.itemId !== instructions.itemId){
              newGlobalItems.push(gItem)
            }
          }
          set(globalSelectedNodesAtom,newGlobalItems)
        }
        //Remove from database
        const pdata = {driveId:driveIdFolderId.driveId,itemId:instructions.itemId}
        const deletepayload = {
          params: pdata
        }
        const { deletedata } = await axios.get("/api/deleteItem.php", deletepayload)

      break;
      case "move items":
        //Don't move if nothing selected or draging folder to itself
        let canMove = true;
        if (get(globalSelectedNodesAtom).length === 0){ canMove = false;}
        //TODO: Does this catch every case of folder into itself?
        for(let gItem of get(globalSelectedNodesAtom)){
          if (gItem.itemId === instructions.itemId){
            console.log("Can't move folder into itself") //TODO: Toast
            canMove = false;
          }
        }
        if (canMove){
          
          // //Add to destination at end
          let destinationFolderObj = get(folderDictionary({driveId:instructions.driveId,folderId:instructions.itemId}))
          let newDestinationFolderObj = {...destinationFolderObj};
          newDestinationFolderObj["defaultOrder"] = [...destinationFolderObj.defaultOrder];
          newDestinationFolderObj["contentsDictionary"] = {...destinationFolderObj.contentsDictionary}
          let globalSelectedItems = get(globalSelectedNodesAtom)

          let sourcesByParentFolderId = {};

          for(let gItem of globalSelectedItems){
            //Deselect Item
            let selecteditem = {driveId:gItem.driveId,browserId:gItem.browserId,itemId:gItem.itemId}
            set(selectedDriveItemsAtom(selecteditem),false)

            //Prepare to Add to destination
            const oldSourceFInfo = get(folderDictionary({driveId:instructions.driveId,folderId:gItem.parentFolderId}));
            newDestinationFolderObj["contentsDictionary"][gItem.itemId] = {...oldSourceFInfo["contentsDictionary"][gItem.itemId]}
            newDestinationFolderObj["defaultOrder"].push(gItem.itemId)

            //Prepare to Remove from source
            let newSourceFInfo = sourcesByParentFolderId[gItem.parentFolderId];
            if (!newSourceFInfo){
              newSourceFInfo = {...oldSourceFInfo}
              newSourceFInfo["defaultOrder"] = [...oldSourceFInfo.defaultOrder];
              newSourceFInfo["contentsDictionary"] = {...oldSourceFInfo.contentsDictionary}
              
              sourcesByParentFolderId[gItem.parentFolderId] = newSourceFInfo;
            }
            let index = newSourceFInfo["defaultOrder"].indexOf(gItem.itemId);
              newSourceFInfo["defaultOrder"].splice(index,1)
              delete newSourceFInfo["contentsDictionary"][gItem.itemId];
            
          }
          //Add all to destination
          set(folderDictionary({driveId:instructions.driveId,folderId:instructions.itemId}),newDestinationFolderObj);
          //Clear global selection
          set(globalSelectedNodesAtom,[])
          //Remove from sources
          for (let parentFolderId of Object.keys(sourcesByParentFolderId)){
            set(folderDictionary({driveId:instructions.driveId,folderId:parentFolderId}),sourcesByParentFolderId[parentFolderId])
          }

          let selectedItemIds = [];
          for (let item of globalSelectedItems){
            selectedItemIds.push(item.itemId);
          }

          const payload = {
            sourceDriveId:globalSelectedItems[0].driveId,
            selectedItemIds, 
            destinationItemId:destinationFolderObj.folderInfo.itemId,
            destinationParentFolderId:destinationFolderObj.folderInfo.parentFolderId,
            destinationDriveId:driveIdFolderId.driveId
          }
          axios.post("/api/moveItems.php", payload)
          .then((resp)=>{
            // console.log(resp.data)
          }
          )
          
        }
      break;
      default:
        console.warn(`Intruction ${instructions.instructionType} not currently handled`)
    }
    
  }
  // set:(setObj,newValue)=>({set,get})=>{
  //   console.log("setObj",setObj,newValue);

  // }
})

function DriveRouted(props){
  console.log("=== DriveRouted")
  const driveInfo = useRecoilValueLoadable(loadDriveInfoQuery(props.driveId))
  const setBrowserId = useSetRecoilState(browserIdDictionary(props.driveId))
  let browserId = useRef("");

  if (driveInfo.state === "loading"){ return null;}
  if (driveInfo.state === "hasError"){ 
    console.error(driveInfo.contents)
    return null;}

  if (browserId.current === ""){ 
    browserId.current = nanoid();
    setBrowserId((old)=>{let newArr = [...old]; newArr.push(browserId.current); return newArr;});
  }

  //Use Route to determine path variables
  let pathFolderId = props.driveId; //default 
  let pathDriveId = props.driveId; //default
  let routePathDriveId = "";
  let routePathFolderId = "";  
  let pathItemId = "";  
  let urlParamsObj = Object.fromEntries(new URLSearchParams(props.route.location.search));
  //use defaults if not defined
  if (urlParamsObj?.path !== undefined){
    [routePathDriveId,routePathFolderId,pathItemId] = urlParamsObj.path.split(":");
    if (routePathDriveId !== ""){pathDriveId = routePathDriveId;}
    if (routePathFolderId !== ""){pathFolderId = routePathFolderId;}
  }
  //If navigation then build from root else build from path
  let rootFolderId = pathFolderId;
  if(props.isNav){
    rootFolderId = props.driveId;
  }


  return <>
  <LogVisible browserId={browserId.current} />
  {/* <Folder driveId={props.driveId} folderId={rootFolderId} indentLevel={0} rootCollapsible={true}/> */}
  <Folder 
  driveId={props.driveId} 
  folderId={rootFolderId} 
  indentLevel={0}  
  driveObj={props.driveObj} 
  rootCollapsible={props.rootCollapsible}
  browserId={browserId.current}
  isNav={props.isNav}
  urlClickBehavior={props.urlClickBehavior}
  route={props.route}
  pathItemId={pathItemId}
  />
  </>
}

const folderOpenAtom = atomFamily({
  key:"folderOpenAtom",
  default:false
})

const folderOpenSelector = selectorFamily({
  key:"folderOpenSelector",
  set:(browserIdItemId) => ({get,set})=>{
    const isOpen = get(folderOpenAtom(browserIdItemId))
    set(folderOpenAtom(browserIdItemId),!isOpen); 
  }
})

let encodeParams = p => 
Object.entries(p).map(kv => kv.map(encodeURIComponent).join("=")).join("&");

function Folder(props){

  let itemId = props?.folderId;
  if (!itemId){ itemId = props.driveId}
  //Used to determine range of items in Shift Click
  const isOpen = useRecoilValue(folderOpenAtom({browserId:props.browserId,itemId:props.folderId}))
  const toggleOpen = useSetRecoilState(folderOpenSelector({browserId:props.browserId,itemId:props.folderId}))

  let history = useHistory();
  
  const [folderInfo,setFolderInfo] = useRecoilStateLoadable(folderDictionarySelector({driveId:props.driveId,folderId:props.folderId}))

  console.log(`=== 📁 ${folderInfo?.contents?.folderInfo?.label}`)
  const setSelected = useSetRecoilState(selectedDriveItems({driveId:props.driveId,browserId:props.browserId,itemId})); 
  const isSelected = useRecoilValue(selectedDriveItemsAtom({driveId:props.driveId,browserId:props.browserId,itemId})); 
  const deleteItem = (itemId) =>{setFolderInfo({instructionType:"delete item",browserId:props.browserId,itemId})}

  const indentPx = 20;
  let bgcolor = "#e2e2e2";
  if (isSelected  || (props.isNav && itemId === props.pathItemId)) { bgcolor = "#6de5ff"; }
  if (props.appearance === "dropperview") { bgcolor = "#53ff47"; }
  if (props.appearance === "dragged") { bgcolor = "#f3ff35"; }  
 
  let openCloseText = isOpen ? "Close" : "Open";
  let deleteButton = <button
  data-doenet-browserid={props.browserId}
  onClick={(e)=>{
    e.preventDefault();
    e.stopPropagation();
    deleteItem(itemId)
  }}
  >Delete</button>

  let openCloseButton = <button 
  data-doenet-browserid={props.browserId}
  onClick={(e)=>{
    e.preventDefault();
    e.stopPropagation();
    toggleOpen();
  }}>{openCloseText}</button>

  let label = folderInfo?.contents?.folderInfo?.label;
  let folder = <div
      data-doenet-browserid={props.browserId}
      tabIndex={0}
      className="noselect nooutline" 
      style={{
        cursor: "pointer",
        width: "300px",
        padding: "4px",
        border: "1px solid black",
        backgroundColor: bgcolor,
        margin: "2px",
      }}
      onClick={(e)=>{
        if (props.isNav){
          //Only select one item
          let urlParamsObj = Object.fromEntries(new URLSearchParams(props.route.location.search));

          let newParams = {...urlParamsObj} 
          newParams['path'] = `${props.driveId}:${itemId}:${itemId}:Folder`
          history.push('?'+encodeParams(newParams))
        }else{
          if (!e.shiftKey && !e.metaKey){
            setSelected({instructionType:"one item",parentFolderId:props.parentFolderId})
          }else if (e.shiftKey && !e.metaKey){
            setSelected({instructionType:"range to item",parentFolderId:props.parentFolderId})
          }else if (!e.shiftKey && e.metaKey){
            setSelected({instructionType:"add item",parentFolderId:props.parentFolderId})
          }
        }
        
        }}
        onBlur={(e) => {
          //Don't clear on navigation changes
          if (!props.isNav){
          //Only clear if focus goes outside of this node group
            if (e.relatedTarget === null ||
              (e.relatedTarget.dataset.doenetBrowserid !== props.browserId &&
              !e.relatedTarget.dataset.doenetBrowserStayselected)
              ){
                setSelected({instructionType:"clear all"})
            }
          }
        }}
      >
        <div 
      className="noselect" 
      style={{
        marginLeft: `${props.indentLevel * indentPx}px`
      }}>{openCloseButton} Folder {label} {deleteButton} ({folderInfo.contents.defaultOrder.length})</div></div>
  let items = null;
  if (props.driveObj){
    //Root of Drive
    label = props.driveObj.label;
    folder = <>
    <button 
      data-doenet-browserid={props.browserId}
    onClick={()=>{
    setFolderInfo({instructionType:"move items",driveId:props.driveId,itemId:"f1"})
    }}>Move Demo</button>
    <div
      data-doenet-browserid={props.browserId}
      tabIndex={0}
      className="noselect nooutline" 
      style={{
        cursor: "pointer",
        width: "300px",
        padding: "4px",
        border: "1px solid black",
        backgroundColor: bgcolor,
        margin: "2px",
        marginLeft: `${props.indentLevel * indentPx}px`
      }}
      onClick={(e)=>{
        if (props.isNav){
          //Only select one item
          let urlParamsObj = Object.fromEntries(new URLSearchParams(props.route.location.search));

          let newParams = {...urlParamsObj} 
          newParams['path'] = `${props.driveId}:${itemId}:${itemId}:Drive`
          history.push('?'+encodeParams(newParams))
        }
      }
    }
    >Drive {label} ({folderInfo.contents.defaultOrder.length})</div></>
    if (props.rootCollapsible){
      folder = <div
        data-doenet-browserid={props.browserId}
        tabIndex={0}
        className="noselect nooutline" 
        style={{
          cursor: "pointer",
          width: "300px",
          padding: "4px",
          border: "1px solid black",
          backgroundColor: bgcolor,
          margin: "2px",
          marginLeft: `${props.indentLevel * indentPx}px`
        }}
      > {openCloseButton} Drive {label} ({folderInfo.contents.defaultOrder.length})</div>
    }
  }

  if (isOpen || (props.driveObj && !props.rootCollapsible)){
    let dictionary = folderInfo.contents.contentsDictionary;
    items = [];
    for (let itemId of folderInfo.contents.defaultOrder){
      let item = dictionary[itemId];
      switch(item.itemType){
        case "Folder":
        items.push(<Folder 
          key={`item${itemId}${props.browserId}`} 
          driveId={props.driveId} 
          folderId={item.itemId} 
          indentLevel={props.indentLevel+1}  
          browserId={props.browserId}
          route={props.route}
          isNav={props.isNav}
          urlClickBehavior={props.urlClickBehavior}
          pathItemId={props.pathItemId}
          deleteItem={deleteItem}
          parentFolderId={props.folderId}

          />)
        break;
        case "Url":
          items.push(<Url 
            key={`item${itemId}${props.browserId}`} 
            driveId={props.driveId} 
            item={item} 
            indentLevel={props.indentLevel+1}  
            browserId={props.browserId}
            route={props.route}
            isNav={props.isNav} 
            urlClickBehavior={props.urlClickBehavior}
            pathItemId={props.pathItemId}
            deleteItem={deleteItem}
          />)
        break;
        case "DoenetML":
          items.push(<DoenetML 
            key={`item${itemId}${props.browserId}`} 
            driveId={props.driveId} 
            item={item} 
            indentLevel={props.indentLevel+1}  
            browserId={props.browserId}
            route={props.route}
            isNav={props.isNav} 
            pathItemId={props.pathItemId}
            deleteItem={deleteItem}
            />)
        break;
        default:
        console.warn(`Item not rendered of type ${item.itemType}`)
      }
 
    }

    if (folderInfo.contents.defaultOrder.length === 0){
      items.push(<EmptyNode key={`emptyitem${folderInfo?.contents?.folderInfo?.itemId}`}/>)
    }
  }
  return <>
  {folder}
  {items}
  </>
}

const EmptyNode =  React.memo(function Node(props){

  return (<div style={{
    width: "300px",
    padding: "4px",
    border: "1px solid black",
    backgroundColor: "white",
    margin: "2px",
  
  }} ><div className="noselect" style={{ textAlign: "center" }} >EMPTY</div></div>)
})

function LogVisible(props){
  const globalSelected = useRecoilValue(globalSelectedNodesAtom);
  console.log(">>>>globalSelected",globalSelected)
  return null;
}

const selectedDriveItemsAtom = atomFamily({
  key:"selectedDriveItemsAtom",
  default:false
})

const selectedDriveItems = selectorFamily({
  key:"selectedDriveItems",
  // get:(driveIdBrowserIdItemId) =>({get})=>{ 
  //   return get(selectedDriveItemsAtom(driveIdBrowserIdItemId));
  // },
  set:(driveIdBrowserIdItemId) => ({get,set},instruction)=>{
    const globalSelected = get(globalSelectedNodesAtom);
    const isSelected = get(selectedDriveItemsAtom(driveIdBrowserIdItemId))
    const {driveId,browserId,itemId} = driveIdBrowserIdItemId;
    function findRange({clickNeedle,lastNeedle,foundClickNeedle=false,foundLastNeedle=false,currentFolderId}){
      let itemIdsParentFolderIdsInRange = [];
      let folder = get(folderDictionary({driveId,folderId:currentFolderId}))
      // console.log(">>>folder",folder)
      for (let itemId of folder.defaultOrder){
        if (foundClickNeedle && foundLastNeedle){
          break;
        }
        if (clickNeedle === itemId){ foundClickNeedle = true;}
        if (lastNeedle === itemId){ foundLastNeedle = true;}
        //Add itemId if inside the range or an end point then add to itemIds
        if (foundClickNeedle || foundLastNeedle){
          itemIdsParentFolderIdsInRange.push({itemId,parentFolderId:currentFolderId});
        }
        
        
        if (folder.contentsDictionary[itemId].itemType === "Folder"){
          const isOpen = get(folderOpenAtom({browserId,itemId}))
          //Recurse if open
          if (isOpen){
            let [subItemIdsParentFolderIdsInRange,subFoundClickNeedle,subFoundLastNeedle] = 
            findRange({clickNeedle,lastNeedle,foundClickNeedle,foundLastNeedle,currentFolderId:itemId});
            itemIdsParentFolderIdsInRange.push(...subItemIdsParentFolderIdsInRange);
            if (subFoundClickNeedle){foundClickNeedle = true;}
            if (subFoundLastNeedle){foundLastNeedle = true;}
          }
          
        }
        if (foundClickNeedle && foundLastNeedle){
          break;
        }
      }
      return [itemIdsParentFolderIdsInRange,foundClickNeedle,foundLastNeedle];
    }
    switch (instruction.instructionType) {
      case "one item":
        if (!isSelected){
          for (let itemObj of globalSelected){
            set(selectedDriveItemsAtom(itemObj),false)
          }
          set(selectedDriveItemsAtom(driveIdBrowserIdItemId),true)
          let itemInfo = {...driveIdBrowserIdItemId}
          itemInfo["parentFolderId"] = instruction.parentFolderId;
          set(globalSelectedNodesAtom,[itemInfo])
        }
        break;
      case "add item":
        if (isSelected){
          set(selectedDriveItemsAtom(driveIdBrowserIdItemId),false)
          let newGlobalSelected = [...globalSelected];
          const index = newGlobalSelected.indexOf(driveIdBrowserIdItemId)
          newGlobalSelected.splice(index,1)
          set(globalSelectedNodesAtom,newGlobalSelected);
        }else{
          set(selectedDriveItemsAtom(driveIdBrowserIdItemId),true)
          let itemInfo = {...driveIdBrowserIdItemId}
          itemInfo["parentFolderId"] = instruction.parentFolderId;
          set(globalSelectedNodesAtom,[...globalSelected,itemInfo])
        }
        break;
      case "range to item":
        if (globalSelected.length === 0){
          //No previous items selected so just select this one
          set(selectedDriveItemsAtom(driveIdBrowserIdItemId),true)
          let itemInfo = {...driveIdBrowserIdItemId}
          itemInfo["parentFolderId"] = instruction.parentFolderId;
          set(globalSelectedNodesAtom,[itemInfo])
        }else{
          let lastSelectedItem = globalSelected[globalSelected.length-1];

          //TODO: Just select one if browserId doesn't match
          //Starting at root build array of visible items in order
          let [selectTheseItemIdParentFolderIds] = findRange({
            currentFolderId:driveId,
            lastNeedle:lastSelectedItem.itemId,
            clickNeedle:driveIdBrowserIdItemId.itemId});
          let addToGlobalSelected = []
          for (let itemIdParentFolderIdsToSelect of selectTheseItemIdParentFolderIds){
            let itemKey = {...driveIdBrowserIdItemId}
            itemKey.itemId = itemIdParentFolderIdsToSelect.itemId;
            let forGlobal = {...itemKey}
            forGlobal.parentFolderId = itemIdParentFolderIdsToSelect.parentFolderId;
            if (!get(selectedDriveItemsAtom(itemKey))){
              set(selectedDriveItemsAtom(itemKey),true)
              addToGlobalSelected.push(forGlobal);
            }
          }
          //TODO: Does this have the parentFolderId?
          set(globalSelectedNodesAtom,[...globalSelected,...addToGlobalSelected])

        }
      break;
      case "clear all":
          //TODO: Only clear this browser?
          for (let itemObj of globalSelected){
            const {parentFolderId,...atomFormat} = itemObj;  //Without parentFolder
            set(selectedDriveItemsAtom(atomFormat),false)
          }
          set(globalSelectedNodesAtom,[]);
        break;
      default:
        console.warn(`Can't handle instruction ${instruction}`)
        break;
    }
    
  }
})

const DoenetML = React.memo((props)=>{
  console.log(`=== 📜 DoenetML`)

  const history = useHistory();
  const setSelected = useSetRecoilState(selectedDriveItems({driveId:props.driveId,browserId:props.browserId,itemId:props.item.itemId})); 
  const isSelected = useRecoilValue(selectedDriveItemsAtom({driveId:props.driveId,browserId:props.browserId,itemId:props.item.itemId})); 
  // console.log(">>>>isSelected",isSelected,props.item.itemId)

  const indentPx = 20;
  let bgcolor = "#e2e2e2";
  if (isSelected || (props.isNav && props.item.itemId === props.pathItemId)) { bgcolor = "#6de5ff"; }
  if (props.appearance === "dropperview") { bgcolor = "#53ff47"; }
  if (props.appearance === "dragged") { bgcolor = "#f3ff35"; }  

  let deleteButton = <button
  data-doenet-browserid={props.browserId}
  onClick={(e)=>{
    e.preventDefault();
    e.stopPropagation();
    props.deleteItem(props.item.itemId)
  }}
  >Delete</button>

  return <div
      data-doenet-browserid={props.browserId}
      tabIndex={0}
      className="noselect nooutline" 
      style={{
        cursor: "pointer",
        width: "300px",
        padding: "4px",
        border: "1px solid black",
        backgroundColor: bgcolor,
        margin: "2px",
      }}
      onClick={(e)=>{
        
        if (props.isNav){
          //Only select one item
          let urlParamsObj = Object.fromEntries(new URLSearchParams(props.route.location.search));
          let newParams = {...urlParamsObj} 
          newParams['path'] = `${props.driveId}:${props.item.parentFolderId}:${props.item.itemId}:DoenetML`
          history.push('?'+encodeParams(newParams))
        }else{
          if (!e.shiftKey && !e.metaKey){
            setSelected({instructionType:"one item",parentFolderId:props.item.parentFolderId})
          }else if (e.shiftKey && !e.metaKey){
            setSelected({instructionType:"range to item",parentFolderId:props.item.parentFolderId})
          }else if (!e.shiftKey && e.metaKey){
            setSelected({instructionType:"add item",parentFolderId:props.item.parentFolderId})
          }
        }
       
      }}
      onBlur={(e) => {
        //Don't clear on navigation changes
        if (!props.isNav){
        //Only clear if focus goes outside of this node group
          if (e.relatedTarget === null ||
            (e.relatedTarget.dataset.doenetBrowserid !== props.browserId &&
            !e.relatedTarget.dataset.doenetBrowserStayselected)
            ){
              setSelected({instructionType:"clear all"})
          }
        }
      }}
      ><div 
      className="noselect" 
      style={{
        marginLeft: `${props.indentLevel * indentPx}px`
      }}>
    DoenetML {props.item?.label} {deleteButton} </div></div>

  })

const Url = React.memo((props)=>{
  console.log(`=== 🔗 Url`)
  // console.log(">>>url",props)

  const history = useHistory();
  const setSelected = useSetRecoilState(selectedDriveItems({driveId:props.driveId,browserId:props.browserId,itemId:props.item.itemId})); 
  const isSelected = useRecoilValue(selectedDriveItemsAtom({driveId:props.driveId,browserId:props.browserId,itemId:props.item.itemId})); 
  // console.log(">>>>isSelected",isSelected,props.item.itemId)

  const indentPx = 20;
  let bgcolor = "#e2e2e2";
  if (isSelected || (props.isNav && props.item.itemId === props.pathItemId)) { bgcolor = "#6de5ff"; }
  if (props.appearance === "dropperview") { bgcolor = "#53ff47"; }
  if (props.appearance === "dragged") { bgcolor = "#f3ff35"; }  
  let deleteButton = <button
  data-doenet-browserid={props.browserId}
  onClick={(e)=>{
    e.preventDefault();
    e.stopPropagation();
    props.deleteItem(props.item.itemId)
  }}
  >Delete</button>

  return <div
      data-doenet-browserid={props.browserId}
      tabIndex={0}
      className="noselect nooutline" 
      style={{
        cursor: "pointer",
        width: "300px",
        padding: "4px",
        border: "1px solid black",
        backgroundColor: bgcolor,
        margin: "2px",
      }}
      onClick={(e)=>{
        if (props.urlClickBehavior === "select"){
          if (props.isNav){
            //Only select one item
            let urlParamsObj = Object.fromEntries(new URLSearchParams(props.route.location.search));
            let newParams = {...urlParamsObj} 
            newParams['path'] = `${props.driveId}:${props.item.parentFolderId}:${props.item.itemId}:Url`
            history.push('?'+encodeParams(newParams))
          }else{
            if (!e.shiftKey && !e.metaKey){
              setSelected({instructionType:"one item",parentFolderId:props.item.parentFolderId})
            }else if (e.shiftKey && !e.metaKey){
              setSelected({instructionType:"range to item",parentFolderId:props.item.parentFolderId})
            }else if (!e.shiftKey && e.metaKey){
              setSelected({instructionType:"add item",parentFolderId:props.item.parentFolderId})
            }
          }
        }else{
          //Default url behavior is new tab
          let linkTo = props.item?.url; //Enable this when add URL is completed
          window.open(linkTo)
          // window.open("http://doenet.org")

          // location.href = linkTo; 
          // location.href = "http://doenet.org"; 
        }
      }}
      onBlur={(e) => {
        //Don't clear on navigation changes
        if (!props.isNav){
        //Only clear if focus goes outside of this node group
          if (e.relatedTarget === null ||
            (e.relatedTarget.dataset.doenetBrowserid !== props.browserId &&
            !e.relatedTarget.dataset.doenetBrowserStayselected)
            ){
              setSelected({instructionType:"clear all"})
          }
        }
      }}
      ><div 
      className="noselect" 
      style={{
        marginLeft: `${props.indentLevel * indentPx}px`
      }}>
    Url {props.item?.label} {deleteButton}</div></div>

  })