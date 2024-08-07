// import axios from 'axios';
import {
  Button,
  Box,
  Icon,
  Text,
  Flex,
  Wrap,
  useDisclosure,
  Center,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Drawer,
  MenuItem,
  Heading,
  Link,
} from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import {
  redirect,
  useOutletContext,
  useLoaderData,
  useNavigate,
  useFetcher,
} from "react-router-dom";
import styled from "styled-components";

import { RiEmotionSadLine } from "react-icons/ri";
import ContentCard from "../../../_reactComponents/PanelHeaderComponents/ContentCard";
import { GeneralActivityControls } from "./ActivityEditor";
import axios from "axios";

// what is a better solution than this?
let folderJustCreated = -1; // if a folder was just created, set autoFocusName true for the card with the matching activity/folder id

export async function action({ request, params }) {
  const formData = await request.formData();
  let formObj = Object.fromEntries(formData);

  if (formObj._action == "update general") {
    //Don't let name be blank
    let name = formObj?.name?.trim();
    if (name == "") {
      name = "Untitled";
    }

    let learningOutcomes;
    if (formObj.learningOutcomes) {
      learningOutcomes = JSON.parse(formObj.learningOutcomes);
    }
    let isPublic;

    if (formObj.isPublic) {
      isPublic = formObj.isPublic === "true";
    }

    await axios.post("/api/updateContentSettings", {
      name,
      imagePath: formObj.imagePath,
      isPublic,
      id: formObj.activityId,
      learningOutcomes,
    });

    if (formObj.doenetmlVersionId) {
      // TODO: handle other updates to just a document
      await axios.post("/api/updateDocumentSettings", {
        docId: formObj.docId,
        doenetmlVersionId: formObj.doenetmlVersionId,
      });
    }

    return true;
  } else if (formObj?._action == "Add Activity") {
    //Create an activity and redirect to the editor for it
    let { data } = await axios.post(
      `/api/createActivity/${params.folderId ?? ""}`,
    );

    let { activityId, docId } = data;
    return redirect(`/activityEditor/${activityId}`);
  } else if (formObj?._action == "Add Folder") {
    let { data } = await axios.post(
      `/api/createFolder/${params.folderId ?? ""}`,
    );
    folderJustCreated = data.folderId;

    return true;
  } else if (formObj?._action == "Delete Activity") {
    await axios.post(`/api/deleteActivity`, {
      activityId: formObj.id,
    });

    return true;
  } else if (formObj?._action == "Delete Folder") {
    await axios.post(`/api/deleteFolder`, {
      folderId: formObj.id === "null" ? null : formObj.id,
    });

    return true;
  } else if (formObj?._action == "Update Public") {
    await axios.post(`/api/updateIsPublicContent`, {
      id: formObj.id,
      isPublic: !(formObj.isPublic === "true"),
    });

    return true;
  } else if (formObj?._action == "Assign Activity") {
    await axios.post(`/api/assignActivity`, {
      id: formObj.id,
    });
    return redirect(`/assignmentEditor/${formObj.id}`);
  } else if (formObj?._action == "Duplicate Activity") {
    await axios.post(`/api/duplicateActivity`, {
      activityId: formObj.id,
      desiredParentFolderId:
        formObj.folderId === "null" ? null : formObj.folderId,
    });
    return true;
  } else if (formObj?._action == "Move") {
    await axios.post(`/api/moveContent`, {
      id: formObj.id,
      desiredParentFolderId: params.folderId,
      desiredPosition: formObj.desiredPosition,
    });
    return true;
  } else if (formObj._action == "update title") {
    //Don't let name be blank
    let name = formObj?.cardTitle?.trim();
    if (name == "") {
      name = "Untitled " + (formObj.isFolder ? "Folder" : "Activity");
    }
    await axios.post(`/api/updateContentName`, {
      id: Number(formObj.id),
      name,
    });
    return true;
  } else if (formObj?._action == "noop") {
    return true;
  }

  throw Error(`Action "${formObj?._action}" not defined or not handled.`);
}

export async function loader({ params }) {
  const { data } = await axios.get(
    `/api/getFolderContent/${params.folderId ?? ""}`,
  );
  if (data.notMe) {
    return redirect(`/publicActivities/${params.userId}`);
  }

  return {
    folderId: params.folderId ?? null,
    folder: data.folder,
    allDoenetmlVersions: data.allDoenetmlVersions,
    userId: params.userId,
    parentFolderId: data.folder.parentFolderId,
  };
}

const ActivitiesSection = styled.div`
  padding: 10px;
  margin: 0px;
  justify-content: center;
  align-items: center;
  text-align: center;
  background: var(--lightBlue);
  height: 100vh;
`;

function ActivitySettingsDrawer({
  isOpen,
  onClose,
  finalFocusRef,
  id,
  content,
  allDoenetmlVersions,
}) {
  const fetcher = useFetcher();
  let activityData;
  if (id) {
    let index = content.findIndex((obj) => obj.id == id);
    if (index != -1) {
      activityData = content[index];
    } else {
      //Throw error not found
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      finalFocusRef={finalFocusRef}
      size="lg"
    >
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <Center>
            <Text>Activity Settings</Text>
          </Center>
        </DrawerHeader>

        <DrawerBody>
          {id && (
            <GeneralActivityControls
              fetcher={fetcher}
              activityId={id}
              docId={activityData.docId}
              activityData={activityData}
              allDoenetmlVersions={allDoenetmlVersions}
            />
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

export function Activities() {
  let context = useOutletContext();
  let { folderId, folder, allDoenetmlVersions, userId, parentFolderId } =
    useLoaderData();
  const [activityId, setActivityId] = useState();
  const controlsBtnRef = useRef(null);
  const navigate = useNavigate();

  const {
    isOpen: settingsAreOpen,
    onOpen: settingsOnOpen,
    onClose: settingsOnClose,
  } = useDisclosure();

  useEffect(() => {
    document.title = `Activities - Doenet`;
  }, []);

  const fetcher = useFetcher();

  //Don't do more processing if we don't know if we are signed in or not
  if (context.signedIn == null) {
    return null;
  }

  function getCardMenuList(
    isPublic,
    isFolder,
    isAssigned,
    id,
    position,
    numCards,
  ) {
    return (
      <>
        <MenuItem
          data-test={`Make ${isPublic ? "Private" : "Public"} Menu Item`}
          onClick={() => {
            fetcher.submit(
              { _action: "Update Public", isPublic, id },
              { method: "post" },
            );
          }}
        >
          Make {isPublic ? "Private" : "Public"}
        </MenuItem>
        {!isFolder ? (
          <>
            <MenuItem
              data-test={"Duplicate Activity"}
              onClick={() => {
                fetcher.submit(
                  { _action: "Duplicate Activity", id, folderId },
                  { method: "post" },
                );
              }}
            >
              Duplicate Activity
            </MenuItem>
            {!isAssigned ? (
              <MenuItem
                data-test="Assign Activity Menu Item"
                onClick={() => {
                  fetcher.submit(
                    { _action: "Assign Activity", id },
                    { method: "post" },
                  );
                }}
              >
                Assign Activity
              </MenuItem>
            ) : null}
          </>
        ) : null}
        {position > 0 ? (
          <MenuItem
            data-test="Move Left Menu Item"
            onClick={() => {
              fetcher.submit(
                { _action: "Move", id, desiredPosition: position - 1 },
                { method: "post" },
              );
            }}
          >
            Move Left
          </MenuItem>
        ) : null}
        {position < numCards - 1 ? (
          <MenuItem
            data-test="Move Right Menu Item"
            onClick={() => {
              fetcher.submit(
                { _action: "Move", id, desiredPosition: position + 1 },
                { method: "post" },
              );
            }}
          >
            Move Right
          </MenuItem>
        ) : null}
        <MenuItem
          data-test="Delete Menu Item"
          onClick={() => {
            fetcher.submit(
              { _action: isFolder ? "Delete Folder" : "Delete Activity", id },
              { method: "post" },
            );
          }}
        >
          Delete
        </MenuItem>
        <MenuItem
          data-test="Settings Menu Item"
          onClick={() => {
            setActivityId(id);
            settingsOnOpen();
          }}
        >
          Settings
        </MenuItem>
      </>
    );
  }

  return (
    <>
      <ActivitySettingsDrawer
        isOpen={settingsAreOpen}
        onClose={settingsOnClose}
        finalFocusRef={controlsBtnRef}
        id={activityId}
        content={folder.content}
        allDoenetmlVersions={allDoenetmlVersions}
      />
      <Box
        backgroundColor="#fff"
        color="#000"
        height="80px"
        width="100%"
        textAlign="center"
      >
        <Heading as="h2" size="lg" paddingTop=".5em">
          My Activities
        </Heading>
        <div style={{ float: "right" }}>
          <Button
            margin="3px"
            size="xs"
            colorScheme="blue"
            onClick={async () => {
              let id = fetcher.submit(
                { _action: "Add Folder" },
                { method: "post" },
              );
            }}
          >
            + Add Folder
          </Button>
          <Button
            margin="3px"
            data-test="Add Activity"
            size="xs"
            colorScheme="blue"
            onClick={async () => {
              //Create an activity and redirect to the editor for it
              // let { data } = await axios.post("/api/createActivity");
              // let { activityId } = data;
              // navigate(`/activityEditor/${activityId}`);

              // TODO - review this, elsewhere the fetcher is being used, and
              // there was code up in the action() method for this action
              // that was unused. This appears to work okay though? And it
              // would make it consistent with how API requests are done elsewhere
              fetcher.submit({ _action: "Add Activity" }, { method: "post" });
            }}
          >
            + Add Activity
          </Button>
          <Button
            margin="3px"
            size="xs"
            colorScheme="blue"
            onClick={() =>
              navigate(`/allAssignmentScores${folderId ? "/" + folderId : ""}`)
            }
          >
            See Scores
          </Button>
        </div>
      </Box>
      {folderId ? (
        <Box style={{ marginLeft: "15px", marginTop: "-30px", float: "left" }}>
          <Link
            href={`/activities/${userId}${parentFolderId ? "/" + parentFolderId : ""}`}
            style={{
              color: "var(--mainBlue)",
            }}
          >
            {" "}
            &lt; Back
          </Link>
        </Box>
      ) : null}
      <ActivitiesSection data-test="Public Activities">
        <Wrap p="10px" overflow="visible">
          {folder.content.length < 1 ? (
            <Flex
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              alignContent="center"
              minHeight={200}
              background="doenet.canvas"
              padding={20}
              width="100%"
              backgroundColor="transparent"
            >
              <Icon fontSize="48pt" as={RiEmotionSadLine} />
              <Text fontSize="36pt">No Activities Yet</Text>
            </Flex>
          ) : (
            <>
              {folder.content.map((activity, position) => {
                return (
                  <ContentCard
                    key={`Card${activity.id}`}
                    {...activity}
                    title={activity.name}
                    ownerName={folder.name}
                    menuItems={getCardMenuList(
                      activity.isPublic,
                      activity.isFolder,
                      activity.isAssigned,
                      activity.id,
                      position,
                      folder.content.length,
                    )}
                    suppressAvatar={true}
                    showOwnerName={false}
                    imageLink={
                      activity.isFolder
                        ? `/activities/${activity.ownerId}/${activity.id}`
                        : activity.isAssigned
                          ? `/assignmentEditor/${activity.id}`
                          : `/activityEditor/${activity.id}`
                    }
                    editableTitle={true}
                    autoFocusTitle={folderJustCreated === activity.id}
                  />
                );
              })}
            </>
          )}
        </Wrap>
      </ActivitiesSection>
    </>
  );
}
