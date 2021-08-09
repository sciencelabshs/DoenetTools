import React, {useState} from "../../_snowpack/pkg/react.js";
import {
  atom,
  selector,
  atomFamily,
  selectorFamily,
  useRecoilCallback
} from "../../_snowpack/pkg/recoil.js";
import axios from "../../_snowpack/pkg/axios.js";
import sha256 from "../../_snowpack/pkg/crypto-js/sha256.js";
import CryptoJS from "../../_snowpack/pkg/crypto-js.js";
import {CopyToClipboard} from "../../_snowpack/pkg/react-copy-to-clipboard.js";
import {useToast, toastType} from "../Toast.js";
import {FontAwesomeIcon} from "../../_snowpack/pkg/@fortawesome/react-fontawesome.js";
import {
  faExternalLinkAlt
} from "../../_snowpack/pkg/@fortawesome/free-solid-svg-icons.js";
import {
  faClipboard
} from "../../_snowpack/pkg/@fortawesome/free-regular-svg-icons.js";
import {nanoid} from "../../_snowpack/pkg/nanoid.js";
import {folderDictionaryFilterSelector} from "../../_reactComponents/Drive/NewDrive.js";
import Button from "../../_reactComponents/PanelHeaderComponents/Button.js";
import ButtonGroup from "../../_reactComponents/PanelHeaderComponents/ButtonGroup.js";
export const itemHistoryAtom = atomFamily({
  key: "itemHistoryAtom",
  default: selectorFamily({
    key: "itemHistoryAtom/Default",
    get: (doenetId) => async () => {
      let draft = {};
      let named = [];
      let autoSaves = [];
      if (!doenetId) {
        return {draft, named, autoSaves};
      }
      const {data} = await axios.get(`/api/loadVersions.php?doenetId=${doenetId}`);
      draft = data.versions[0];
      for (let version of data.versions) {
        if (version.isDraft === "1") {
          continue;
        }
        if (version.isNamed === "1") {
          named.push(version);
          continue;
        }
        autoSaves.push(version);
      }
      return {draft, named, autoSaves};
    }
  })
});
export const fileByContentId = atomFamily({
  key: "fileByContentId",
  default: selectorFamily({
    key: "fileByContentId/Default",
    get: (contentId) => async () => {
      if (!contentId) {
        return "";
      }
      const local = localStorage.getItem(contentId);
      if (local) {
        return local;
      }
      try {
        const server = await axios.get(`/media/${contentId}.doenet`);
        return server.data;
      } catch (err) {
        return "Error Loading";
      }
    }
  })
});
export const drivecardSelectedNodesAtom = atom({
  key: "drivecardSelectedNodesAtom",
  default: []
});
export const fetchDrivesQuery = atom({
  key: "fetchDrivesQuery",
  default: selector({
    key: "fetchDrivesQuery/Default",
    get: async () => {
      const {data} = await axios.get(`/api/loadAvailableDrives.php`);
      return data;
    }
  })
});
export const fetchDrivesSelector = selector({
  key: "fetchDrivesSelector",
  get: ({get}) => {
    return get(fetchDrivesQuery);
  },
  set: ({get, set}, labelTypeDriveIdColorImage) => {
    let driveData = get(fetchDrivesQuery);
    let newDriveData = {...driveData};
    newDriveData.driveIdsAndLabels = [...driveData.driveIdsAndLabels];
    let params = {
      driveId: labelTypeDriveIdColorImage.newDriveId,
      label: labelTypeDriveIdColorImage.label,
      type: labelTypeDriveIdColorImage.type,
      image: labelTypeDriveIdColorImage.image,
      color: labelTypeDriveIdColorImage.color
    };
    let newDrive;
    function duplicateFolder({sourceFolderId, sourceDriveId, destDriveId, destFolderId, destParentFolderId}) {
      let contentObjs = {};
      const sourceFolder = get(folderDictionaryFilterSelector({driveId: sourceDriveId, folderId: sourceFolderId}));
      if (destFolderId === void 0) {
        destFolderId = destDriveId;
        destParentFolderId = destDriveId;
      }
      let contentIds = {defaultOrder: []};
      let contentsDictionary = {};
      let folderInfo = {...sourceFolder.folderInfo};
      folderInfo.folderId = destFolderId;
      folderInfo.parentFolderId = destParentFolderId;
      for (let sourceItemId of sourceFolder.contentIds.defaultOrder) {
        const destItemId = nanoid();
        contentIds.defaultOrder.push(destItemId);
        let sourceItem = sourceFolder.contentsDictionary[sourceItemId];
        contentsDictionary[destItemId] = {...sourceItem};
        contentsDictionary[destItemId].parentFolderId = destFolderId;
        contentsDictionary[destItemId].itemId = destItemId;
        if (sourceItem.itemType === "Folder") {
          let childContentObjs = duplicateFolder({sourceFolderId: sourceItemId, sourceDriveId, destDriveId, destFolderId: destItemId, destParentFolderId: destFolderId});
          contentObjs = {...contentObjs, ...childContentObjs};
        } else if (sourceItem.itemType === "DoenetML") {
          let destDoenetId = nanoid();
          contentsDictionary[destItemId].sourceDoenetId = sourceItem.doenetId;
          contentsDictionary[destItemId].doenetId = destDoenetId;
        } else if (sourceItem.itemType === "URL") {
          let desturlId = nanoid();
          contentsDictionary[destItemId].urlId = desturlId;
        } else {
          console.log(`!!! Unsupported type ${sourceItem.itemType}`);
        }
        contentObjs[destItemId] = contentsDictionary[destItemId];
      }
      const destFolderObj = {contentIds, contentsDictionary, folderInfo};
      set(folderDictionary({driveId: destDriveId, folderId: destFolderId}), destFolderObj);
      return contentObjs;
    }
    if (labelTypeDriveIdColorImage.type === "new content drive") {
      newDrive = {
        driveId: labelTypeDriveIdColorImage.newDriveId,
        isShared: "0",
        label: labelTypeDriveIdColorImage.label,
        type: "content"
      };
      newDriveData.driveIdsAndLabels.unshift(newDrive);
      set(fetchDrivesQuery, newDriveData);
      const payload = {params};
      axios.get("/api/addDrive.php", payload);
    } else if (labelTypeDriveIdColorImage.type === "new course drive") {
      newDrive = {
        driveId: labelTypeDriveIdColorImage.newDriveId,
        isShared: "0",
        label: labelTypeDriveIdColorImage.label,
        type: "course",
        image: labelTypeDriveIdColorImage.image,
        color: labelTypeDriveIdColorImage.color,
        subType: "Administrator"
      };
      newDriveData.driveIdsAndLabels.unshift(newDrive);
      set(fetchDrivesQuery, newDriveData);
      const payload = {params};
      axios.get("/api/addDrive.php", payload);
    } else if (labelTypeDriveIdColorImage.type === "update drive label") {
      for (let [i, drive] of newDriveData.driveIdsAndLabels.entries()) {
        if (drive.driveId === labelTypeDriveIdColorImage.newDriveId) {
          let newDrive2 = {...drive};
          newDrive2.label = labelTypeDriveIdColorImage.label;
          newDriveData.driveIdsAndLabels[i] = newDrive2;
          break;
        }
      }
      set(fetchDrivesQuery, newDriveData);
      const payload = {params};
      axios.get("/api/updateDrive.php", payload);
    } else if (labelTypeDriveIdColorImage.type === "update drive color") {
    } else if (labelTypeDriveIdColorImage.type === "delete drive") {
      let driveIdsAndLabelsLength = newDriveData.driveIdsAndLabels;
      for (let i = 0; i < driveIdsAndLabelsLength.length; i++) {
        for (let x = 0; x < labelTypeDriveIdColorImage.newDriveId.length; x++) {
          if (driveIdsAndLabelsLength[i].driveId === labelTypeDriveIdColorImage.newDriveId[x]) {
            newDriveData.driveIdsAndLabels.splice(i, 1);
            i = i == 0 ? i : i - 1;
          }
        }
      }
      set(fetchDrivesQuery, newDriveData);
      const payload = {params};
      axios.get("/api/updateDrive.php", payload);
    }
  }
});
export const loadAssignmentSelector = selectorFamily({
  key: "loadAssignmentSelector",
  get: (doenetId) => async ({get, set}) => {
    const {data} = await axios.get(`/api/getAllAssignmentSettings.php?doenetId=${doenetId}`);
    return data;
  }
});
export const assignmentDictionary = atomFamily({
  key: "assignmentDictionary",
  default: selectorFamily({
    key: "assignmentDictionary/Default",
    get: (driveIditemIddoenetIdparentFolderId) => async ({get}, instructions) => {
      let folderInfoQueryKey = {
        driveId: driveIditemIddoenetIdparentFolderId.driveId,
        folderId: driveIditemIddoenetIdparentFolderId.folderId
      };
      let folderInfo = get(folderDictionaryFilterSelector(folderInfoQueryKey));
      const itemObj = folderInfo?.contentsDictionary?.[driveIditemIddoenetIdparentFolderId.itemId];
      if (driveIditemIddoenetIdparentFolderId.doenetId) {
        const aInfo = await get(loadAssignmentSelector(driveIditemIddoenetIdparentFolderId.doenetId));
        if (aInfo) {
          return aInfo?.assignments[0];
        } else
          return null;
      } else
        return null;
    }
  })
});
export let assignmentDictionarySelector = selectorFamily({
  key: "assignmentDictionarySelector",
  get: (driveIditemIddoenetIdparentFolderId) => ({get}) => {
    return get(assignmentDictionary(driveIditemIddoenetIdparentFolderId));
  }
});
export const variantInfoAtom = atom({
  key: "variantInfoAtom",
  default: {index: null, name: null, lastUpdatedIndexOrName: null, requestedVariant: {index: 1}}
});
export const variantPanelAtom = atom({
  key: "variantPanelAtom",
  default: {index: null, name: null}
});
export function buildTimestamp() {
  const dt = new Date();
  return `${dt.getFullYear().toString().padStart(2, "0")}-${(dt.getMonth() + 1).toString().padStart(2, "0")}-${dt.getDate().toString().padStart(2, "0")} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}:${dt.getSeconds().toString().padStart(2, "0")}`;
}
export const getSHAofContent = (doenetML) => {
  if (doenetML === void 0) {
    return;
  }
  let contentId = sha256(doenetML).toString(CryptoJS.enc.Hex);
  return contentId;
};
export function ClipboardLinkButtons(props) {
  const addToast = useToast();
  const link = `http://${window.location.host}/content/#/?contentId=${props.contentId}`;
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(ButtonGroup, null, /* @__PURE__ */ React.createElement(CopyToClipboard, {
    onCopy: () => addToast("Link copied to clipboard!", toastType.SUCCESS),
    text: link
  }, /* @__PURE__ */ React.createElement(Button, {
    disabled: props.disabled,
    icon: /* @__PURE__ */ React.createElement(FontAwesomeIcon, {
      icon: faClipboard
    }),
    value: "copy link"
  })), /* @__PURE__ */ React.createElement(Button, {
    icon: /* @__PURE__ */ React.createElement(FontAwesomeIcon, {
      icon: faExternalLinkAlt
    }),
    value: "visit",
    disabled: props.disabled,
    onClick: () => window.open(link, "_blank")
  })));
}
export function RenameVersionControl(props) {
  let [textFieldFlag, setTextFieldFlag] = useState(false);
  let [currentTitle, setCurrentTitle] = useState(props.title);
  const renameVersion = useRecoilCallback(({set}) => async (doenetId, versionId, newTitle) => {
    set(itemHistoryAtom(doenetId), (was) => {
      let newHistory = {...was};
      newHistory.named = [...was.named];
      let newVersion;
      for (const [i, version] of newHistory.named.entries()) {
        if (versionId === version.versionId) {
          newVersion = {...version};
          newVersion.title = newTitle;
          newHistory.named.splice(i, 1, newVersion);
        }
      }
      let newDBVersion = {
        ...newVersion,
        isNewTitle: "1",
        doenetId
      };
      axios.post("/api/saveNewVersion.php", newDBVersion);
      return newHistory;
    });
  });
  function renameIfChanged() {
    setTextFieldFlag(false);
    if (props.title !== currentTitle) {
      renameVersion(props.doenetId, props.versionId, currentTitle);
    }
  }
  if (!textFieldFlag) {
    return /* @__PURE__ */ React.createElement(Button, {
      disabled: props.disabled,
      onClick: () => setTextFieldFlag(true),
      value: "Rename"
    });
  }
  return /* @__PURE__ */ React.createElement("input", {
    type: "text",
    autoFocus: true,
    value: currentTitle,
    onChange: (e) => {
      setCurrentTitle(e.target.value);
    },
    onKeyDown: (e) => {
      if (e.key === "Enter") {
        renameIfChanged();
      }
    },
    onBlur: () => {
      renameIfChanged();
    }
  });
}