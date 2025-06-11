import { callable, findModule, sleep, Millennium, Menu, MenuItem, showContextMenu, DialogButton, TextField, ModalRoot, showModal } from "@steambrew/client";
import { render } from "react-dom";
import React, { useState, useEffect } from "react";

// Backend functions
const get_coll_image = callable<[{ coll_id: string }], string>('Backend.get_coll_image');
const set_coll_image = callable<[{ coll_id: string, image_data: string }], boolean>('Backend.set_coll_image');
const get_last_filter = callable<[{ coll_id: string, op_type: string }], string>('Backend.get_last_filter');
const set_last_filter = callable<[{ coll_id: string, op_type: string, op_data: string }], boolean>('Backend.set_last_filter');
const get_folder = callable<[{ coll_id: string }], string>('Backend.get_folder');
const set_folder = callable<[{ coll_id: string, folder_path: string }], boolean>('Backend.set_folder');
const get_folder_list = callable<[{}], string>('Backend.get_folder_list');
const get_folder_map = callable<[{}], string>('Backend.get_folder_map');
const add_folder = callable<[{ folder_path: string }], boolean>('Backend.add_folder');
const remove_folder = callable<[{ folder_path: string }], boolean>('Backend.remove_folder');

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];

const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];

async function OnPopupCreation(popup: any) {
    if (popup.m_strName === "SP Desktop_uid0") {
        var mwbm = undefined;
        while (!mwbm) {
            console.log("[steam-collections-plus] Waiting for MainWindowBrowserManager");
            try {
                mwbm = MainWindowBrowserManager;
            } catch {
                await sleep(100);
            }
        }

        MainWindowBrowserManager.m_browser.on("finished-request", async (currentURL, previousURL) => {
            if (MainWindowBrowserManager.m_lastLocation.pathname === "/library/collections") {
                const folderList = JSON.parse(await get_folder_list({}));
                const folderMap = JSON.parse(await get_folder_map({}));

                const collGrid = await WaitForElement(`div.${findModule(e => e.CSSGrid).CSSGrid}`, popup.m_popup.document);
                if (collGrid) {
                    var currentPath = "root";

                    // Switch folder
                    const switchPath = async (newPath) => {
                        const allItemsList = collGrid.querySelectorAll(":scope > div");
                        for (let i = 0; i < allItemsList.length; i++) {
                            if (allItemsList[i].dataset.itempath === newPath) {
                                allItemsList[i].style.display = "";
                            } else {
                                allItemsList[i].style.display = "none";
                            }
                        }

                        const titlePathElement = collGrid.parentElement.parentElement.parentElement.parentElement.querySelector("div.steam-collections-plus-path");
                        const prettyPath = ": " + newPath.replaceAll("/", " ≫ ");
                        titlePathElement.textContent = prettyPath;

                        currentPath = newPath;
                    };

                    // Tag all collections on the UI with an itempath
                    const collItemList = collGrid.querySelectorAll(`:scope > div:not(.${findModule(e => e.NewCollection).NewCollection})`);
                    for (let i = 0; i < collItemList.length; i++) {
                        const collName = collItemList[i].querySelector(`div.${findModule(e => e.CollectionLabel).CollectionLabel} > div:not(.${findModule(e => e.CollectionLabelCount).CollectionLabelCount})`).textContent;
                        console.log("[steam-collections-plus] Processing collection", collName);

                        var collID = "type-music";
                        const collObj = collectionStore.GetUserCollectionsByName(collName);
                        if (collObj.length > 0) {
                            collID = collObj[0].m_strId;
                        }

                        const imageData = await get_coll_image({ coll_id: collID });
                        if (imageData !== "") {
                            collItemList[i].querySelector(`div.${findModule(e => e.DisplayCaseContainerBounds).DisplayCaseContainerBounds}`).style.display = "none";
                            collItemList[i].querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`).style.backgroundImage = `url(${imageData})`;
                        }

                        collItemList[i].dataset.collectionid = collID;
                        if (collID in folderMap) {
                            collItemList[i].dataset.itempath = folderMap[collID];
                        } else {
                            collItemList[i].dataset.itempath = "root";
                        }
                    }

                    // Add folder items to the UI, incl. itempath
                    const addFolderItem = async (templateItem, folderFullPath) => {
                        const folderPath = folderFullPath.substring(0, folderFullPath.lastIndexOf("/"));
                        const folderName = folderFullPath.substring(folderFullPath.lastIndexOf("/") + 1);

                        const folderItem = templateItem.cloneNode(true);
                        folderItem.querySelector(`div.${findModule(e => e.BigPlus).BigPlus}`).innerHTML = "📁";
                        folderItem.querySelector(`div.${findModule(e => e.CollectionLabel).CollectionLabel}`).textContent = folderName;
                        folderItem.dataset.itempath = folderPath;
                        collGrid.insertBefore(folderItem, templateItem.nextSibling);

                        folderItem.addEventListener("click", async () => {
                            // Enter folder on click
                            const newPath = folderFullPath;
                            switchPath(newPath);
                        });

                        folderItem.addEventListener("contextmenu", async () => {
                            // Right click menu
                            showContextMenu(
                                <Menu label="Collections+ Folder Options">
                                    <MenuItem onClick={async () => {
                                        // Remove folder from database and UI
                                        await remove_folder({ folder_path: folderFullPath });
                                        folderItem.remove();

                                        // Remove subfolders from UI
                                        const allFolderItems = collGrid.querySelectorAll(`:scope > div.${findModule(e => e.NewCollection).NewCollection}`);
                                        for (let j = 0; j < allFolderItems.length; j++) {
                                            if (allFolderItems[j].dataset.itempath.startsWith(`${folderFullPath}/`)) {
                                                allFolderItems[j].remove();
                                            }
                                        }

                                        // Re-tag collections
                                        const allCollectionItems = collGrid.querySelectorAll(`:scope > div:not(.${findModule(e => e.NewCollection).NewCollection})`);
                                        for (let j = 0; j < allCollectionItems.length; j++) {
                                            if (allCollectionItems[j].dataset.itempath === folderFullPath || allCollectionItems[j].dataset.itempath.startsWith(`${folderFullPath}/`)) {
                                                allCollectionItems[j].dataset.itempath = "root";
                                            }
                                        }

                                        // Show moved collections if we are in root
                                        switchPath(currentPath);
                                    }}> Delete folder </MenuItem>
                                </Menu>,
                                folderItem.querySelector(`div.${findModule(e => e.BigPlus).BigPlus}`),
                                { bForcePopup: true }
                            );
                        });
                    };

                    const templateItem = collGrid.querySelector(`:scope > div.${findModule(e => e.NewCollection).NewCollection}`);
                    templateItem.dataset.itempath = "root";
                    for (let i = 0; i < folderList.length; i++) {
                        const folderFullPath = folderList[i];
                        addFolderItem(templateItem, folderFullPath);
                    }

                    // Add new UI elements
                    const oldTitlePathElement = collGrid.querySelector("div.steam-collections-plus-path");
                    if (!oldTitlePathElement) {
                        const titleTextElement = collGrid.parentElement.parentElement.parentElement.parentElement.firstChild.firstChild;
                        const titlePathElement = titleTextElement.cloneNode(true);
                        titlePathElement.classList.add("steam-collections-plus-path");
                        titlePathElement.textContent = ": root";
                        titleTextElement.parentElement.insertBefore(titlePathElement, titleTextElement.nextSibling);

                        // Go to parent folder
                        const upElement = titleTextElement.cloneNode(true);
                        upElement.textContent = "[UP]";
                        titleTextElement.parentElement.insertBefore(upElement, titleTextElement);

                        upElement.addEventListener("click", async () => {
                            // Leave folder
                            if (currentPath !== "root") {
                                const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
                                switchPath(parentPath);
                            }
                        });

                        // Manage current folder
                        const cPlusElement = titleTextElement.cloneNode(true);
                        cPlusElement.textContent = "[C+]";
                        titleTextElement.parentElement.insertBefore(cPlusElement, titleTextElement);

                        cPlusElement.addEventListener("click", async () => {
                            const FolderManagementComponent: React.FC = (props) => {
                                const [managedFolderName, setManagedFolderName] = useState<string>("root");
                                const [collectionStateList, setCollectionStateList] = useState([]);

                                // Get current data
                                const GetCurrentSettings = async () => {
                                    setManagedFolderName(currentPath.substring(currentPath.lastIndexOf("/") + 1));

                                    let wipStateList = [];
                                    const latestFolderMap = JSON.parse(await get_folder_map({}));
                                    for (let i = 0; i < collectionStore.userCollections.length; i++) {
                                        const currentCollID = collectionStore.userCollections[i].m_strId;
                                        if (currentCollID !== "uncategorized") {
                                            const currentCollName = collectionStore.userCollections[i].m_strName;
                                            let currentCollFolder = "root";
                                            if (currentCollID in latestFolderMap) {
                                                currentCollFolder = latestFolderMap[currentCollID];
                                            }
                                            wipStateList.push({collectionID: currentCollID, collectionName: currentCollName, collectionFolder: currentCollFolder});
                                        }
                                    }
                                    setCollectionStateList(wipStateList);
                                };

                                // Add subfolder
                                const AddNewFolder = async (e) => {
                                    const newFolderPath = currentPath + "/" + e.target.parentElement.querySelector("#newFolderName").value;
                                    const successfulAdd = await add_folder({folder_path: newFolderPath});
                                    if (successfulAdd) {
                                        addFolderItem(templateItem, newFolderPath);
                                        switchPath(currentPath);
                                    }
                                };

                                // Add and remove collections to/from folder
                                const ApplyCollectionSelection = async (e) => {
                                    console.log("[steam-collections-plus] Applying selection...");
                                    
                                    const allCheckboxes = e.target.parentElement.querySelectorAll("input[type=checkbox]");
                                    for (let i = 0; i < allCheckboxes.length; i++) {
                                        const collID = allCheckboxes[i].dataset.collectionid;
                                        if (!allCheckboxes[i].checked && allCheckboxes[i].dataset.incurrentfolder === "true") {
                                            // Remove collection from current folder
                                            console.log(`[steam-collections-plus] Removing ${collID} from`, currentPath);
                                            await set_folder({coll_id: collID, folder_path: "root"});
                                            collGrid.querySelector(`:scope > div[data-collectionid="${collID}"]`).dataset.itempath = "root";
                                        } else if (allCheckboxes[i].checked && allCheckboxes[i].dataset.incurrentfolder === "false") {
                                            // Add collection to current folder
                                            console.log(`[steam-collections-plus] Moving ${collID} to`, currentPath);
                                            await set_folder({coll_id: collID, folder_path: currentPath});
                                            collGrid.querySelector(`:scope > div[data-collectionid="${collID}"]`).dataset.itempath = currentPath;
                                        }
                                    }
                                    
                                    switchPath(currentPath);
                                };

                                useEffect(() => {
                                    GetCurrentSettings();
                                }, []);

                                return (
                                    <ModalRoot closeModal={() => {}}>
                                        <span style={{textTransform: "uppercase"}}><b>{managedFolderName}</b></span> <br />
                                        <br />
                                        Create subfolder: <br />
                                        <TextField id="newFolderName" placeholder="Folder"></TextField>
                                        <DialogButton style={{width: "120px"}} onClick={AddNewFolder}>Add</DialogButton>
                                        <hr />
                                        Add collections: <br />
                                        {collectionStateList.map((collectionData, index) => {
                                            return (
                                                <div>
                                                    <input key={index} id={`coll-chkbox-${index}`} data-collectionid={collectionData.collectionID} data-incurrentfolder={collectionData.collectionFolder === currentPath} type="checkbox" defaultChecked={collectionData.collectionFolder === currentPath} />
                                                    <label for={`coll-chkbox-${index}`}>{collectionData.collectionName} (Currently in {collectionData.collectionFolder})</label>
                                                </div>
                                            );
                                        })}
                                        <DialogButton style={{width: "120px"}} onClick={ApplyCollectionSelection}>Apply</DialogButton>
                                    </ModalRoot>
                                );
                            };

                            showModal(
                                <FolderManagementComponent key={currentPath} />,
                                popup.m_popup.window, {strTitle: "Folder Management", bHideMainWindowForPopouts: false, bForcePopOut: true, popupHeight: 700, popupWidth: 400}
                            );
                        });
                    }

                    switchPath("root");
                }
            } else if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/collection/")) {
                const collOptionsDiv = await WaitForElement(`div.${findModule(e => e.CollectionOptions).CollectionOptions}`, popup.m_popup.document);
                const oldCPlusButton = collOptionsDiv.querySelector('button.collectionsplus-button');
                if (!oldCPlusButton) {
                    const cPlusButton = popup.m_popup.document.createElement("div");
                    render(<DialogButton className="collectionsplus-button" style={{width: "40px"}}>C+</DialogButton>, cPlusButton);
                    collOptionsDiv.insertBefore(cPlusButton, collOptionsDiv.firstChild.nextSibling);

                    cPlusButton.addEventListener("click", async () => {
                        async function showBulkUI(addMode, filterOnly) {
                            const cPlusFilterBox = popup.m_popup.document.createElement("div");
                            render(<TextField  placeholder="filter"></TextField>, cPlusFilterBox);
                            collOptionsDiv.insertBefore(cPlusFilterBox, cPlusButton.nextSibling);
                            const cPlusFilterOK = popup.m_popup.document.createElement("div");
                            render(<DialogButton style={{width: "40px"}}>OK</DialogButton>, cPlusFilterOK);
                            collOptionsDiv.insertBefore(cPlusFilterOK, cPlusFilterBox.nextSibling);

                            if (filterOnly) {
                                cPlusFilterBox.querySelector("input").value = await get_last_filter({ coll_id: uiStore.currentGameListSelection.strCollectionId, op_type: "filter" });
                            } else if (addMode) {
                                cPlusFilterBox.querySelector("input").value = await get_last_filter({ coll_id: uiStore.currentGameListSelection.strCollectionId, op_type: "add" });
                            } else {
                                cPlusFilterBox.querySelector("input").value = await get_last_filter({ coll_id: uiStore.currentGameListSelection.strCollectionId, op_type: "remove" });
                            }

                            cPlusFilterOK.addEventListener("click", async () => {
                                const cPlusFilterValue = cPlusFilterBox.querySelector("input").value;
                                console.log("[steam-collections-plus] Applying", cPlusFilterValue);
                                cPlusFilterOK.firstChild.innerHTML = "Working...";

                                var checkedList = undefined;
                                if (filterOnly) {
                                    checkedList = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId).allApps;
                                } else if (addMode) {
                                    checkedList = collectionStore.allAppsCollection.allApps;
                                } else {
                                    checkedList = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId).allApps;
                                }

                                const checkedFilterCollection = cPlusFilterValue.split(";");
                                for (let i = 0; i < checkedList.length; i++) {
                                    const currentApp = checkedList[i];
                                    cPlusFilterOK.firstChild.innerHTML = `Working... (${i}/${checkedList.length})`;

                                    var allTrue = true;
                                    for (let j = 0; j < checkedFilterCollection.length; j++) {
                                        const currentFilterTokens = checkedFilterCollection[j].split(" ");
                                        const currentFilter = [currentFilterTokens[0], currentFilterTokens[1], currentFilterTokens.slice(2).join(" ")];
                                        const leftObjectName = currentFilter[0];
                                        const objectOperator = currentFilter[1];

                                        if (leftObjectName === "collection") {
                                            const rightValue = collectionStore.GetUserCollectionsByName(currentFilter[2])[0];
                                            if (objectOperator === "=") {
                                                if (rightValue.allApps.findIndex((x) => x.appid === currentApp.appid) === -1) {
                                                    allTrue = false;
                                                    break;
                                                }
                                            } else if (objectOperator === "!=") {
                                                if (rightValue.allApps.findIndex((x) => x.appid === currentApp.appid) > -1) {
                                                    allTrue = false;
                                                    break;
                                                }
                                            } else {
                                                console.log("[steam-collections-plus] Invalid operator");
                                            }
                                        } else if (leftObjectName === "category") {
                                            const rightValue = currentFilter[2];
                                            if (objectOperator === "=") {
                                                if (!currentApp.m_setStoreCategories.has(Number(rightValue))) {
                                                    allTrue = false;
                                                    break;
                                                }
                                            } else if (objectOperator === "!=") {
                                                if (currentApp.m_setStoreCategories.has(Number(rightValue))) {
                                                    allTrue = false;
                                                    break;
                                                }
                                            } else {
                                                console.log("[steam-collections-plus] Invalid operator");
                                            }
                                        } else if (leftObjectName === "tag") {
                                            const rightValue = currentFilter[2];
                                            if (objectOperator === "=") {
                                                if (!currentApp.m_setStoreTags.has(Number(rightValue))) {
                                                    allTrue = false;
                                                    break;
                                                }
                                            } else if (objectOperator === "!=") {
                                                if (currentApp.m_setStoreTags.has(Number(rightValue))) {
                                                    allTrue = false;
                                                    break;
                                                }
                                            } else {
                                                console.log("[steam-collections-plus] Invalid operator");
                                            }
                                        } else {
                                            const leftObjectValue = currentApp[leftObjectName];
                                            const leftObjectType = typeof(leftObjectValue);
                                            if (leftObjectType === 'boolean') {
                                                if (objectOperator === "true") {
                                                    if (!leftObjectValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === "false") {
                                                    if (leftObjectValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else {
                                                    console.log("[steam-collections-plus] Invalid operator");
                                                }
                                            } else if (leftObjectType === 'string') {
                                                const rightValue = currentFilter[2];
                                                if (objectOperator === "=") {
                                                    if (leftObjectValue !== rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === "!=") {
                                                    if (leftObjectValue === rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === "begins") {
                                                    if (!leftObjectValue.startsWith(rightValue)) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else {
                                                    console.log("[steam-collections-plus] Invalid operator");
                                                }
                                            } else if (leftObjectType === 'number') {
                                                const rightValue = Number(currentFilter[2]);
                                                if (objectOperator === "=") {
                                                    if (leftObjectValue !== rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === "!=") {
                                                    if (leftObjectValue === rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === "<") {
                                                    if (leftObjectValue >= rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === ">") {
                                                    if (leftObjectValue <= rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === "<=") {
                                                    if (leftObjectValue > rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else if (objectOperator === ">=") {
                                                    if (leftObjectValue < rightValue) {
                                                        allTrue = false;
                                                        break;
                                                    }
                                                } else {
                                                    console.log("[steam-collections-plus] Invalid operator");
                                                }
                                            } else {
                                                console.log("[steam-collections-plus] Unsupported left object type");
                                            }
                                        }
                                    }

                                    if (filterOnly) {
                                        let applicationElement = popup.m_popup.document.querySelector(`div.${findModule(e => e.CSSGrid).CSSGrid} > div > div > div > img[alt="${currentApp.display_name}"]`);
                                        if (applicationElement && allTrue) {
                                            applicationElement.parentElement.parentElement.parentElement.style.display = "";
                                        } else if (applicationElement && !allTrue) {
                                            applicationElement.parentElement.parentElement.parentElement.style.display = "none";
                                        } else {
                                            console.log("[steam-collections-plus] Cannot find element for", currentApp.display_name);
                                        }
                                    } else if (allTrue) {
                                        console.log("[steam-collections-plus] Found", currentApp.display_name);
                                        collectionStore.AddOrRemoveApp([currentApp.appid], addMode, uiStore.currentGameListSelection.strCollectionId);
                                    }
                                }

                                cPlusFilterOK.remove();
                                cPlusFilterBox.remove();
                                if (filterOnly) {
                                    await set_last_filter({ coll_id: uiStore.currentGameListSelection.strCollectionId, op_type: "filter", op_data: cPlusFilterValue });
                                    console.log("[steam-collections-plus] Applications filtered in", uiStore.currentGameListSelection.strCollectionId);
                                } else if (addMode) {
                                    await set_last_filter({ coll_id: uiStore.currentGameListSelection.strCollectionId, op_type: "add", op_data: cPlusFilterValue });
                                    console.log("[steam-collections-plus] Applications added to", uiStore.currentGameListSelection.strCollectionId);
                                } else {
                                    await set_last_filter({ coll_id: uiStore.currentGameListSelection.strCollectionId, op_type: "remove", op_data: cPlusFilterValue });
                                    console.log("[steam-collections-plus] Applications removed from", uiStore.currentGameListSelection.strCollectionId);
                                }
                            });
                        }

                        showContextMenu(
                            <Menu label="Collections+ Options">
                                <MenuItem onClick={async () => {
                                    showBulkUI(true, false);
                                }}> Add applications in bulk </MenuItem>

                                <MenuItem onClick={async () => {
                                    showBulkUI(false, false);
                                }}> Remove applications in bulk </MenuItem>

                                <MenuItem onClick={async () => {
                                    showBulkUI(false, true);
                                }}> Filter applications </MenuItem>

                                <MenuItem onClick={async () => {
                                    const inputFileElement = popup.m_popup.document.createElement("input");
                                    inputFileElement.type = "file";
                                    inputFileElement.style.display = "none";
                                    inputFileElement.addEventListener('change', (e) => {
                                        if (e.target.files) {
                                            console.log(e.target.files[0]);
                                            const imageFile = e.target.files[0];
                                            if (imageFile) {
                                                const reader = new FileReader();
                                                reader.onload = async (f) => {
                                                    const imageData = reader.result;
                                                    await set_coll_image({ coll_id: uiStore.currentGameListSelection.strCollectionId, image_data: imageData });

                                                    console.log("[steam-collections-plus] Image set for", uiStore.currentGameListSelection.strCollectionId);
                                                };
                                                reader.readAsDataURL(imageFile);
                                            }
                                        }
                                        inputFileElement.remove();
                                    });
                                    collOptionsDiv.appendChild(inputFileElement);
                                    inputFileElement.click();
                                }}> Set collection image </MenuItem>

                                <MenuItem onClick={async () => {
                                    await set_coll_image({ coll_id: uiStore.currentGameListSelection.strCollectionId, image_data: "" });

                                    console.log("[steam-collections-plus] Image reset for", uiStore.currentGameListSelection.strCollectionId);
                                }}> Reset collection image </MenuItem>

                                <MenuItem onClick={async () => {
                                    const currentColl = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId);
                                    const randomIndex = Math.floor(Math.random() * (currentColl.allApps.length + 1));
                                    SteamClient.Apps.RunGame(currentColl.allApps[randomIndex].appid.toString(), "", 0, 0);
                                }}> Start random application </MenuItem>

                                <MenuItem onClick={async () => {
                                    const currentColl = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId);
                                    const randomIndex = Math.floor(Math.random() * (currentColl.allApps.length + 1));
                                    const gameName = currentColl.allApps[randomIndex].display_name;
                                    const gameListItemList = await WaitForElementList('div.ReactVirtualized__Grid__innerScrollContainer > div.Panel > div > div.Focusable', popup.m_popup.document);
                                    const gameItem = gameListItemList.find(el => el.textContent === gameName);
                                    if (gameItem) {
                                        gameItem.click();
                                    }
                                }}> Show random application </MenuItem>
                            </Menu>,
                            cPlusButton,
                            { bForcePopup: true }
                        );
                    });
                }
            } else if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/app/")) {
                const gameSettingsButton = await WaitForElement(`div.${findModule(e => e.InPage).InPage} div.${findModule(e => e.AppButtonsContainer).AppButtonsContainer} > div.${findModule(e => e.MenuButtonContainer).MenuButtonContainer}:not([role="button"])`, popup.m_popup.document);
                const oldCPlusButton = gameSettingsButton.parentNode.querySelector('div.coll-plus-app-button');
                if (!oldCPlusButton) {
                    const cPlusButton = gameSettingsButton.cloneNode(true);
                    cPlusButton.classList.add("coll-plus-app-button");
                    cPlusButton.firstChild.innerHTML = "C+";
                    gameSettingsButton.parentNode.insertBefore(cPlusButton, gameSettingsButton.nextSibling);

                    cPlusButton.addEventListener("click", async () => {
                        const CollectionManagementComponent: React.FC = (props) => {
                            const treeStyle: React.CSSProperties = {
                                '--spacing': '1.5rem',
                                '--radius': '10px'
                            };

                            const liStyle: React.CSSProperties = {
                                display: 'block',
                                position: 'relative',
                                paddingLeft: 'calc(2 * var(--spacing) - var(--radius) - 2px)'
                            };

                            const ulStyle: React.CSSProperties = {
                                marginLeft: 'calc(var(--radius) - var(--spacing))',
                                paddingLeft: '0'
                            };

                            const [managedAppName, setManagedAppName] = useState<string>("");
                            const [folderList, setFolderList] = useState([]);
                            const [collectionStateList, setCollectionStateList] = useState([]);

                            // Get current data
                            const GetCurrentSettings = async () => {
                                const currentApp = appStore.allApps.find((x) => x.appid === uiStore.currentGameListSelection.nAppId);
                                setManagedAppName(currentApp.display_name);

                                
                                setFolderList(["root"].concat(JSON.parse(await get_folder_list({}))));

                                let wipStateList = [];
                                const latestFolderMap = JSON.parse(await get_folder_map({}));
                                for (let i = 0; i < collectionStore.userCollections.length; i++) {
                                    const currentCollID = collectionStore.userCollections[i].m_strId;
                                    if (currentCollID !== "uncategorized") {
                                        const currentCollName = collectionStore.userCollections[i].m_strName;
                                        let currentCollFolder = "root";
                                        if (currentCollID in latestFolderMap) {
                                            currentCollFolder = latestFolderMap[currentCollID];
                                        }
                                        let currentCollContainsApp = false;
                                        if (collectionStore.userCollections[i].allApps.find((x) => x.appid === uiStore.currentGameListSelection.nAppId)) {
                                            currentCollContainsApp = true;
                                        }
                                        wipStateList.push({collectionID: currentCollID, collectionName: currentCollName, collectionFolder: currentCollFolder, appInColl: currentCollContainsApp});
                                    }
                                }
                                setCollectionStateList(wipStateList);
                            };

                            // Add and remove collections to/from folder
                            const ApplyCollectionSelection = async (e) => {
                                console.log("[steam-collections-plus] Applying selection...");

                                const allCheckboxes = e.target.parentElement.querySelectorAll("input[type=checkbox]");
                                for (let i = 0; i < allCheckboxes.length; i++) {
                                    const collID = allCheckboxes[i].dataset.collectionid;
                                    if (!allCheckboxes[i].checked && allCheckboxes[i].dataset.incollection === "true") {
                                        // Remove app from collection
                                        console.log("[steam-collections-plus] Removing app from", collID);
                                        collectionStore.AddOrRemoveApp([uiStore.currentGameListSelection.nAppId], false, collID);
                                        allCheckboxes[i].dataset.incollection = "false";
                                    } else if (allCheckboxes[i].checked && allCheckboxes[i].dataset.incollection === "false") {
                                        // Add app to collection
                                        console.log("[steam-collections-plus] Adding app to", collID);
                                        collectionStore.AddOrRemoveApp([uiStore.currentGameListSelection.nAppId], true, collID);
                                        allCheckboxes[i].dataset.incollection = "true";
                                    }
                                }
                            }

                            useEffect(() => {
                                GetCurrentSettings();
                            }, []);

                            return (
                                <ModalRoot closeModal={() => {}}>
                                    <span style={{textTransform: "uppercase"}}><b>{managedAppName}</b></span> <br />
                                    <br />
                                    Collections: <br />
                                    <ul style={treeStyle}>
                                        {folderList.map((folderPath, index) => {
                                            return (
                                                <li style={liStyle}>
                                                    <details open>
                                                        <summary>{folderPath.replaceAll("/", " ≫ ")}</summary>
                                                        <ul style={ulStyle}>
                                                            {collectionStateList.filter((x) => x.collectionFolder === folderPath).map((collectionData, index) => {
                                                                return (
                                                                    <li style={liStyle}>
                                                                        <input key={collectionData.collectionID} id={`coll-chkbox-${collectionData.collectionID}`} data-collectionid={collectionData.collectionID} data-incollection={collectionData.appInColl} type="checkbox" defaultChecked={collectionData.appInColl} />
                                                                        <label for={`coll-chkbox-${collectionData.collectionID}`}>{collectionData.collectionName}</label>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </details>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <DialogButton style={{width: "120px"}} onClick={ApplyCollectionSelection}>Apply</DialogButton>
                                </ModalRoot>
                            );
                        };

                        showModal(
                            <CollectionManagementComponent key={uiStore.currentGameListSelection.nAppId} />,
                            popup.m_popup.window, {strTitle: "Collections", bHideMainWindowForPopouts: false, bForcePopOut: true, popupHeight: 700, popupWidth: 500}
                        );
                    });
                }
            }
        });
    }
}

export default async function PluginMain() {
    console.log("[steam-collections-plus] Frontend startup");

    const doc = g_PopupManager.GetExistingPopup("SP Desktop_uid0");
	if (doc) {
		OnPopupCreation(doc);
	}

	g_PopupManager.AddPopupCreatedCallback(OnPopupCreation);
}
