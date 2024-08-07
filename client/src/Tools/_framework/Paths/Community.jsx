import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Heading,
  Icon,
  MenuItem,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
  Wrap,
  Flex,
  VStack,
  Checkbox,
  FormLabel,
} from "@chakra-ui/react";
import { useLoaderData } from "react-router";
import { Carousel } from "../../../_reactComponents/PanelHeaderComponents/Carousel";
import Searchbar from "../../../_reactComponents/PanelHeaderComponents/SearchBar";
import { Form, useFetcher } from "react-router-dom";
import { RiEmotionSadLine } from "react-icons/ri";
import ContentCard from "../../../_reactComponents/PanelHeaderComponents/ContentCard";
import AuthorCard from "../../../_reactComponents/PanelHeaderComponents/AuthorCard";

export async function action({ request }) {
  const formData = await request.formData();
  let formObj = Object.fromEntries(formData);
  let {
    desiredPosition,
    activityId,
    groupName,
    newGroupName,
    groupId,
    currentlyFeatured,
    homepage,
  } = formObj;

  // TODO: should this function exist?
  // Could be bad pattern to catch all API errors as browser alerts
  async function postApiAlertOnError(url, uploadData) {
    try {
      const response = await axios.post(url, uploadData);
      return true;
    } catch (e) {
      console.log(e);
      alert("Error - " + e.response?.data);
      return false;
    }
  }

  switch (formObj?._action) {
    case "Ban Content":
      return postApiAlertOnError("/api/markContentAsBanned", { activityId });
    case "Remove Promoted Content":
      return postApiAlertOnError("/api/removePromotedContent", {
        activityId,
        groupId,
      });
    case "Move Promoted Content":
      return postApiAlertOnError("/api/movePromotedContent", {
        activityId,
        groupId,
        desiredPosition,
      });
    case "Move Promoted Group":
      return postApiAlertOnError("/api/movePromotedContentGroup", {
        groupId,
        desiredPosition,
      });
    case "New Group": {
      return postApiAlertOnError("/api/addPromotedContentGroup", { groupName });
    }
    case "Rename Group": {
      return postApiAlertOnError("/api/addPromotedContentGroup", {
        groupName,
      });
    }
    case "Promote Group": {
      // convert to real booleans
      currentlyFeatured =
        !currentlyFeatured || currentlyFeatured == "false" ? false : true;
      homepage = !homepage || homepage == "false" ? false : true;
      return postApiAlertOnError("/api/updatePromotedContentGroup", {
        groupId,
        newGroupName,
        currentlyFeatured,
        homepage,
      });
    }
    case "Delete Group": {
      return postApiAlertOnError("/api/deletePromotedContentGroup", {
        groupId,
      });
    }
  }
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  if (q) {
    //Show search results
    const { data: searchData } = await axios.get(
      `/api/searchPublicContent?q=${q}`,
    );

    const {
      data: { isAdmin },
    } = await axios.get(`/api/checkForCommunityAdmin`);

    let carouselGroups = [];
    if (isAdmin) {
      const carouselGroupsData = await axios.get(
        `/api/loadPromotedContentGroups`,
      );
      carouselGroups = carouselGroupsData.data;
    }

    return {
      q,
      searchResults: searchData,
      carouselGroups,
      isAdmin,
    };
  } else {
    const { data: isAdminData } = await axios.get(
      `/api/checkForCommunityAdmin`,
    );
    const isAdmin = isAdminData.isAdmin;
    const { data: carouselData } = await axios.get("/api/loadPromotedContent");
    return { carouselData, isAdmin };
  }
}

export function DoenetHeading(props) {
  return (
    <Flex
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      height="40px"
      flexShrink={0}
    >
      <Heading as="h2" size="lg">
        {props.heading}
      </Heading>
      <Heading as="h3" size="md">
        {props.subheading}
      </Heading>
    </Flex>
  );
}

export function MoveToGroupMenuItem({ activityId, carouselGroups }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = React.useRef();
  const fetcher = useFetcher();

  if (!carouselGroups) {
    carouselGroups = [];
  }

  const banContent = () => {
    if (window.confirm("Are you sure you want to ban this content?")) {
      fetcher.submit(
        { _action: "Ban Content", activityId },
        { method: "post" },
      );
    }
  };

  const promoteGroup = (groupInfo, currentlyFeatured) => {
    fetcher.submit(
      {
        _action: "Promote Group",
        // groupName: groupInfo.groupName,
        groupId: groupInfo.promotedGroupId,
        currentlyFeatured,
        homepage: false,
      },
      { method: "post" },
    );
  };

  const moveGroup = (groupInfo, desiredPosition) => {
    fetcher.submit(
      {
        _action: "Move Promoted Group",
        groupId: groupInfo.promotedGroupId,
        desiredPosition,
      },
      { method: "post" },
    );
  };

  const promoteContent = async (groupInfo) => {
    const uploadData = {
      groupId: groupInfo.promotedGroupId,
      activityId,
    };
    axios
      .post("/api/addPromotedContent", uploadData)
      .then(({ data }) => {
        onClose();
      })
      .catch((e) => {
        console.log(e);
        alert("Error - " + e.response?.data);
      });
  };

  const createGroup = () => {
    const groupName = window.prompt("Enter a new group name");
    if (groupName) {
      fetcher.submit({ _action: "New Group", groupName }, { method: "post" });
    }
  };

  const renameGroup = (groupInfo) => {
    const newGroupName = window.prompt(
      "Enter a new name for group " + groupInfo.groupName,
      groupInfo.groupName,
    );
    if (newGroupName) {
      fetcher.submit(
        {
          _action: "Promote Group",
          groupId: groupInfo.promotedGroupId,
          currentlyFeatured: groupInfo.currentlyFeatured,
          newGroupName,
          homepage: false,
        },
        { method: "post" },
      );
    }
  };

  const deleteGroup = (groupId, groupName) => {
    const shouldDelete = confirm(
      `Are you sure you want to delete ${groupName}? You can't undo this action afterwards.`,
    );
    if (shouldDelete) {
      fetcher.submit(
        {
          _action: "Delete Group",
          groupId,
        },
        { method: "post" },
      );
    }
  };

  return (
    <>
      <MenuItem ref={btnRef} onClick={onOpen}>
        Promote on Community Page
      </MenuItem>
      <MenuItem as="button" type="submit" ref={btnRef} onClick={banContent}>
        Remove from Community for TOS Violation
      </MenuItem>
      <Drawer
        isOpen={isOpen}
        placement="right"
        onClose={onClose}
        finalFocusRef={btnRef}
        size="lg"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Add Activity To Group</DrawerHeader>

          <DrawerBody>
            <VStack spacing="2">
              {carouselGroups.map((group) => {
                return (
                  <Button
                    margin="5px"
                    key={group.groupName}
                    onClick={() => promoteContent(group)}
                  >
                    Add to group "{group.groupName}"
                  </Button>
                );
              })}
              <br />
              <Button onClick={() => createGroup()}>Add New Group</Button>
            </VStack>
            <Box>
              <VStack spacing="2">
                <Text fontSize="xl">
                  Select which groups are shown on the community page
                </Text>

                <Form>
                  {carouselGroups.map((group, position) => {
                    return (
                      <Wrap key={group.promotedGroupId}>
                        <Checkbox
                          isDisabled={group.homepage}
                          isChecked={group.currentlyFeatured}
                          name={group.groupId}
                          onChange={(evt) =>
                            promoteGroup(group, evt.target.checked)
                          }
                        />
                        <FormLabel htmlFor={group.groupId} width="200px">
                          {group.groupName}
                        </FormLabel>
                        <Button onClick={() => renameGroup(group)}>
                          Rename
                        </Button>
                        <Button
                          isDisabled={position === 0}
                          onClick={() => moveGroup(group, position - 1)}
                        >
                          ↑
                        </Button>
                        <Button
                          isDisabled={position === carouselGroups.length - 1}
                          onClick={() => moveGroup(group, position + 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          isDisabled={group.homepage}
                          onClick={() =>
                            deleteGroup(group.promotedGroupId, group.groupName)
                          }
                        >
                          Delete
                        </Button>
                      </Wrap>
                    );
                  })}
                </Form>
              </VStack>
            </Box>
          </DrawerBody>

          <DrawerFooter>
            <Button variant="outline" mr={3} onClick={onClose}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function Community() {
  const { carouselData, q, searchResults, carouselGroups, isAdmin } =
    useLoaderData();
  const [currentTab, setCurrentTab] = useState(0);
  const fetcher = useFetcher();

  useEffect(() => {
    document.title = `Community - Doenet`;
  }, []);

  if (searchResults) {
    let allMatches = [
      ...searchResults?.content.map((a) => ({ type: "activity", ...a })),
      ...searchResults?.users,
    ];
    const tabs = [
      {
        label: "All Matches",
        count: allMatches.length,
      },
      {
        label: "Activities",
        count: searchResults?.content?.length,
      },
      {
        label: "Authors",
        count: searchResults?.users?.length,
      },
    ];

    return (
      <>
        <Flex
          flexDirection="column"
          p={4}
          mt="1rem"
          justifyContent="center"
          alignItems="center"
          textAlign="center"
          height="20px"
        >
          <Box maxW={400} minW={200}>
            <Box w="400px">
              <Form>
                <Searchbar defaultValue={q} dataTest="Search" />
              </Form>
            </Box>
          </Box>
        </Flex>
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          height="100px"
          background="doenet.canvas"
        >
          <Text fontSize="24px">
            Results for{" "}
            <Text
              as="span"
              fontSize="24px"
              fontWeight="700"
              data-test="Search Results For"
            >
              {q}
            </Text>
          </Text>
        </Box>
        <Tabs
          orientation="vertical"
          minHeight="calc(100vh - 150px)"
          variant="line"
        >
          <TabList background="doenet.canvas" w={240}>
            {tabs.map((tab, index) => (
              <Flex w="100%" position="relative" key={`tab-${index}`}>
                <Tab
                  key={`tab-${index}`}
                  background="doenet.canvas"
                  fontWeight="700"
                  borderLeft="none"
                  px={3}
                  w="100%"
                  onClick={() => setCurrentTab(index)}
                >
                  <Flex w="100%" alignItems="center" justifyContent="right">
                    {tab.label}
                    <Badge
                      ml={2}
                      w={5}
                      h={5}
                      fontSize="0.8em"
                      background="doenet.lightBlue"
                      borderRadius="full"
                    >
                      {tab.count}
                    </Badge>
                  </Flex>
                </Tab>
                <Box
                  display={currentTab !== index && "none"}
                  position="absolute"
                  right={0}
                  top={0}
                  bottom={0}
                  w={1}
                  borderRadius={5}
                  bg="doenet.mainBlue"
                />
              </Flex>
            ))}
          </TabList>

          <TabPanels background="doenet.mainGray" data-test="Search Results">
            <TabPanel>
              <Wrap
                p={10}
                m={0}
                display="flex"
                justifyContent="center"
                alignItems="center"
                data-test="Results All Matches"
              >
                {allMatches.map((itemObj) => {
                  if (itemObj?.type == "activity") {
                    const { id, imagePath, name, owner, isFolder } = itemObj;
                    if (isFolder) {
                      // TODO
                    } else {
                      const imageLink = `/activityViewer/${id}`;

                      return (
                        <ContentCard
                          key={`ContentCard${id}`}
                          imageLink={imageLink}
                          name={name}
                          imagePath={imagePath}
                          fullName={owner.name}
                          menuItems={
                            isAdmin ? (
                              <>
                                <MoveToGroupMenuItem
                                  activityId={id}
                                  carouselGroups={carouselGroups}
                                />
                              </>
                            ) : null
                          }
                        />
                      );
                    }
                  } else if (itemObj?.type == "author") {
                    const { courseId, firstName, lastName } = itemObj;
                    const imageLink = `/publicActivities/${courseId}`;

                    return (
                      <AuthorCard
                        key={courseId}
                        fullName={`${firstName} ${lastName}`}
                        imageLink={imageLink}
                      />
                    );
                  }
                })}
                {allMatches.length == 0 ? (
                  <Flex
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    alignContent="center"
                    minHeight={200}
                    background="doenet.canvas"
                    padding={20}
                    // border="1px solid var(--canvastext)"
                  >
                    <Icon fontSize="48pt" as={RiEmotionSadLine} />
                    <Text fontSize="36pt">No Matches Found!</Text>
                  </Flex>
                ) : null}
              </Wrap>
            </TabPanel>
            <TabPanel>
              <Wrap
                p={10}
                m={0}
                display="flex"
                justifyContent="center"
                alignItems="center"
                data-test="Results Activities"
              >
                {searchResults?.content.map((activityObj) => {
                  const { id, imagePath, name, owner } = activityObj;
                  console.log({ id, imagePath, name, owner });
                  if (activityObj.isFolder) {
                    // TODO
                  } else {
                    const imageLink = `/activityViewer/${id}`;

                    return (
                      <ContentCard
                        key={id}
                        imageLink={imageLink}
                        imagePath={imagePath}
                        name={name}
                        fullName={owner.name}
                        menuItems={
                          isAdmin ? (
                            <>
                              <MoveToGroupMenuItem
                                activityId={id}
                                carouselGroups={carouselGroups}
                              />
                            </>
                          ) : null
                        }
                      />
                    );
                  }
                })}
                {searchResults?.content?.length == 0 ? (
                  <Flex
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    alignContent="center"
                    minHeight={200}
                    background="doenet.canvas"
                    padding={20}
                    // border="1px solid var(--canvastext)"
                  >
                    <Icon fontSize="48pt" as={RiEmotionSadLine} />
                    <Text fontSize="36pt">No Matching Activities Found!</Text>
                  </Flex>
                ) : null}
                {/* </Box> */}
              </Wrap>
            </TabPanel>
            <TabPanel>
              <Wrap
                p={10}
                m={0}
                display="flex"
                justifyContent="center"
                alignItems="center"
                data-test="Results Authors"
              >
                {searchResults?.users.map((authorObj) => {
                  const { courseId, firstName, lastName } = authorObj;
                  // console.log("authorObj",authorObj)
                  const imageLink = `/publicActivities/${courseId}`;

                  return (
                    <AuthorCard
                      key={courseId}
                      fullName={`${firstName} ${lastName}`}
                      imageLink={imageLink}
                    />
                  );
                })}
                {searchResults?.users?.length == 0 ? (
                  <Flex
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    alignContent="center"
                    minHeight={200}
                    background="doenet.canvas"
                    padding={20}
                    // border="1px solid var(--canvastext)"
                  >
                    <Icon fontSize="48pt" as={RiEmotionSadLine} />
                    <Text fontSize="36pt">No Matching Authors Found!</Text>
                  </Flex>
                ) : null}
              </Wrap>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </>
    );
  }

  return (
    <Flex flexDirection="column" height="100%">
      <Flex
        flexDirection="column"
        p={4}
        mt="1rem"
        justifyContent="center"
        alignItems="center"
        textAlign="center"
        height="20px"
      >
        <Box maxW={400} minW={200}>
          <Box width="400px">
            <Form>
              <Searchbar defaultValue={q} dataTest="Search" />
            </Form>
          </Box>
          {/* <input type='text' width="400px" /> */}
        </Box>
      </Flex>
      <DoenetHeading subheading="Community Content" />
      <Box
        display="flex"
        flexDirection="column"
        padding="60px 10px 200px 10px"
        margin="0px"
        rowGap="45px"
        alignItems="center"
        textAlign="center"
        background="var(--mainGray)"
        flex="1"
      >
        {isAdmin ? (
          <Text>
            You are logged in as an admin and can manage these lists, they will
            show to other users as carousels
          </Text>
        ) : null}
        {carouselData
          .sort((a, b) => {
            if (a.homepage) return -1;
            else if (b.homepage) return 1;
            else if (a.currentlyFeatured && !b.currentlyFeatured) return -1;
            else if (!a.currentlyFeatured && b.currentlyFeatured) return 1;
            else return 0;
          })
          .map((group) => {
            // Homepage only visible to admins
            if (!isAdmin && group.homepage) {
              return null;
            }

            let groupName = group.groupName;
            let notPromoted = false;
            if (
              isAdmin &&
              !group.homepage &&
              group.currentlyFeatured == false
            ) {
              groupName += " (Not currently featured on community page)";
              notPromoted = true;
            }
            return (
              <>
                {isAdmin ? (
                  <span>
                    <Text fontSize="24px">{groupName}</Text>
                    {group.homepage ? (
                      <Text>Always promoted</Text>
                    ) : notPromoted ? (
                      <Button
                        onClick={() => {
                          fetcher.submit(
                            {
                              _action: "Promote Group",
                              groupId: group.promotedGroupId,
                              currentlyFeatured: true,
                              homepage: false,
                            },
                            { method: "post" },
                          );
                        }}
                      >
                        Promote
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          fetcher.submit(
                            {
                              _action: "Promote Group",
                              groupId: group.promotedGroupId,
                              currentlyFeatured: false,
                              homepage: false,
                            },
                            { method: "post" },
                          );
                        }}
                      >
                        Stop Promoting
                      </Button>
                    )}
                    <br />
                    <br />
                    <Wrap overflow="visible">
                      {group.promotedContent.map((cardObj, i) => {
                        return (
                          <ContentCard
                            {...cardObj}
                            key={`swipercard${i}`}
                            fullName={cardObj.owner}
                            imageLink={`/activityViewer/${cardObj.activityId}`}
                            menuItems={
                              <>
                                <MenuItem
                                  onClick={() => {
                                    fetcher.submit(
                                      {
                                        _action: "Remove Promoted Content",
                                        activityId: cardObj.activityId,
                                        groupId: group.promotedGroupId,
                                      },
                                      { method: "post" },
                                    );
                                  }}
                                >
                                  Remove from group
                                </MenuItem>
                                <MenuItem
                                  isDisabled={i === 0}
                                  onClick={() => {
                                    fetcher.submit(
                                      {
                                        _action: "Move Promoted Content",
                                        activityId: cardObj.activityId,
                                        groupId: group.promotedGroupId,
                                        desiredPosition: i - 1,
                                      },
                                      { method: "post" },
                                    );
                                  }}
                                >
                                  Move Left
                                </MenuItem>
                                <MenuItem
                                  isDisabled={
                                    i === group.promotedContent.length - 1
                                  }
                                  onClick={() => {
                                    fetcher.submit(
                                      {
                                        _action: "Move Promoted Content",
                                        activityId: cardObj.activityId,
                                        groupId: group.promotedGroupId,
                                        desiredPosition: i + 1,
                                      },
                                      { method: "post" },
                                    );
                                  }}
                                >
                                  Move Right
                                </MenuItem>
                              </>
                            }
                          />
                        );
                      })}
                    </Wrap>
                  </span>
                ) : (
                  <Carousel title={groupName} data={group.promotedContent} />
                )}
              </>
            );
          })}
      </Box>
    </Flex>
  );
}
