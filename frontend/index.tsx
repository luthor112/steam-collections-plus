import { callable, findModule, sleep, Millennium, Menu, MenuItem, showContextMenu, DialogButton, ModalRoot, showModal, IconsModule, definePlugin, TextField, Dropdown, DropdownOption } from "@steambrew/client";
import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";

declare global {
    var MainWindowBrowserManager: any;
    var collectionStore: any;
    var SteamUIStore: any;
    var uiStore: any;
    var appStore: any;
}

// Backend functions
const get_encoded_image = callable<[{ filename: string }], string>('get_encoded_image');
const save_encoded_image = callable<[{ a_filename: string, b_filedata: string }], boolean>('save_encoded_image');

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

/*const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];*/

/*const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];*/

const WINDOWS_RESERVED_CHARS = ["<", ">", ":", "\"", "/", "\\", "|", "?", "*"];

type CollDB = Record<string, any>;
type FolderList = string[];

var collDB: CollDB = {};
var folderList: FolderList = [];

function save_coll_db() {
    localStorage.setItem("luthor112.steam-collections-plus.colldb", JSON.stringify(collDB));
    localStorage.setItem("luthor112.steam-collections-plus.folderlist", JSON.stringify(folderList));
}

function get_safe_fname(fname: string) {
    if (WINDOWS_RESERVED_CHARS.some(ch => fname.includes(ch))) {
        return btoa(fname);
    } else {
        return fname;
    }
}

async function db_get_image(coll_id: string) {
    if (coll_id in collDB) {
        if ("image" in collDB[coll_id]) {
            const fname = get_safe_fname(coll_id);
            if (collDB[coll_id]["image"]) {
                return await get_encoded_image({ filename: fname });
            }
        }
    }
    return "";
}

async function db_save_image(coll_id: string, image_data: string) {
    if (!(coll_id in collDB)) {
        collDB[coll_id] = {};
    }

    if (image_data !== "") {
        const fname = get_safe_fname(coll_id);
        await save_encoded_image({ a_filename: fname, b_filedata: image_data });
        collDB[coll_id]["image"] = true;
    } else {
        collDB[coll_id]["image"] = false;
    }

    save_coll_db();
}

async function get_coll_image(coll_id: string) {
    return await db_get_image(coll_id);
}

async function set_coll_image(coll_id: string, image_data: string) {
    await db_save_image(coll_id, image_data);
}

async function get_folder_image(folder_path: string) {
    const convertedCollID = folder_path.replaceAll("/", "__");
    return await db_get_image(`__folder__${convertedCollID}`);
}

async function set_folder_image(folder_path: string, image_data: string) {
    const convertedCollID = folder_path.replaceAll("/", "__");
    await db_save_image(`__folder__${convertedCollID}`, image_data);
}

/*function get_last_filter(coll_id: string, op_type: string) {
    if (coll_id in collDB) {
        if (op_type in collDB[coll_id]) {
            return collDB[coll_id][op_type];
        }
    }
    return "";
}*/

/*function set_last_filter(coll_id: string, op_type: string, op_data: string) {
    if (!(coll_id in collDB)) {
        collDB[coll_id] = {};
    }
    collDB[coll_id][op_type] = op_data;
    save_coll_db();
}*/

/*function get_folder(coll_id: string) {
    if (coll_id in collDB) {
        if ("folder" in collDB[coll_id]) {
            return collDB[coll_id]["folder"];
        }
    }
    return "root";
}*/

function set_folder(coll_id: string, folder_path: string) {
    if (!(coll_id in collDB)) {
        collDB[coll_id] = {};
    }
    collDB[coll_id]["folder"] = folder_path;
    save_coll_db();
}

function get_folder_list() {
    return folderList;
}

function get_folder_map() {
    let folder_map: Record<string, string> = {};
    for (const [coll_id, coll_data] of Object.entries(collDB)) {
        let coll_folder = "root";
        if ("folder" in coll_data) {
            coll_folder = coll_data["folder"];
        }
        folder_map[coll_id] = coll_folder;
    }
    return folder_map;
}

function add_folder(folder_path: string) {
    if (!folderList.includes(folder_path)) {
        folderList.push(folder_path);
        folderList.sort();
        save_coll_db();
        return true;
    }
    return false;
}

function remove_folder(folder_path: string) {
    let new_folderlist = [];
    for (const current_folder_path of folderList) {
        if ((current_folder_path !== folder_path) && (!current_folder_path.startsWith(`${folder_path}/`))) {
            new_folderlist.push(current_folder_path);
        }
    }
    folderList = new_folderlist;

    for (const [coll_id, coll_data] of Object.entries(collDB)) {
        void coll_id;
        if ("folder" in coll_data) {
            if ((coll_data["folder"] === folder_path) || (coll_data["folder"].startsWith(`${folder_path}/`))) {
                coll_data["folder"] = "root";
            }
        }
    }

    save_coll_db();
}

type GetBulkUIComponentProps = {
    collID: string;
};

function getBulkUIComponent(popup: any) {
    void popup;

    return (props: GetBulkUIComponentProps) => {
        const lineStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
        };

        const itemStyle: React.CSSProperties = {
            width: '200px'
        };

        const itemStyleLong: React.CSSProperties = {
            width: '300px'
        };

        const [managedCollectionID, setManagedCollectionID] = useState<string>("");
        const [managedCollectionName, setManagedCollectionName] = useState<string>("");
        const [currentAppList, setCurrentAppList] = useState<any[]>([]);
        const [selectedSource, setSelectedSource] = useState('currentcollection');
        const [selectedProperty, setSelectedProperty] = useState('display_name');
        const [selectedComparison, setSelectedComparison] = useState('==');
        const [comparisonValue, setComparisonValue] = useState<string>("");
        const [selectedBulkOps, setSelectedBulkOps] = useState('add');
        const [bulkOpsTarget, setBulkOpsTarget] = useState<string>("");

        const sourceOptions = [
            { label: 'All Apps', data: 'allapps' },
            { label: 'Current Collection', data: 'currentcollection' },
            { label: 'Current Filtered List', data: 'filtered' }
        ];

        let propertyOptions: DropdownOption[] = [{ label: 'In collection (true/false)', data: 'in_collection' }];
        Object.keys(appStore.allApps[0]).sort().forEach((e) => propertyOptions.push({ label: e, data: e }));

        const comparisonOptions = [
            { label: '==', data: '==' },
            { label: '!=', data: '!=' },
            { label: '<', data: '<' },
            { label: '>', data: '>' },
            { label: '<=', data: '<=' },
            { label: '>=', data: '>=' },
            { label: 'starts with', data: 'startsWith' },
            { label: 'contains', data: 'contains' },
            { label: 'does not contain', data: '!contains' },
            { label: 'is true', data: 'true' },
            { label: 'is false', data: 'false' }
        ];

        const bulkOpsOptions = [
            { label: 'Bulk add to Current Collection', data: 'add' },
            { label: 'Bulk remove from Current Collection', data: 'remove' },
            { label: 'Add to new collection:', data: 'new' }
        ];

        const DoFiltering = () => {
            let inputList: any[] = [];
            if (selectedSource == 'allapps')
                inputList = appStore.allApps;
            else if (selectedSource == 'currentcollection')
                inputList = collectionStore.GetCollection(managedCollectionID).allApps;
            else if (selectedSource == 'filtered')
                inputList = currentAppList;
            else
                console.log("[steam-collections-plus] Bad source");

            let filteredList: any[] = [];
            for (const checkedApp of inputList) {
                if (selectedComparison == '==' && checkedApp[selectedProperty] == comparisonValue) filteredList.push(checkedApp);
                else if (selectedComparison == '!=' && checkedApp[selectedProperty] != comparisonValue) filteredList.push(checkedApp);
                else if (selectedComparison == '<' && checkedApp[selectedProperty] < comparisonValue) filteredList.push(checkedApp);
                else if (selectedComparison == '>' && checkedApp[selectedProperty] > comparisonValue) filteredList.push(checkedApp);
                else if (selectedComparison == '<=' && checkedApp[selectedProperty] <= comparisonValue) filteredList.push(checkedApp);
                else if (selectedComparison == '>=' && checkedApp[selectedProperty] >= comparisonValue) filteredList.push(checkedApp);
                else if (selectedComparison == 'startsWith' && checkedApp[selectedProperty].startsWith(comparisonValue)) filteredList.push(checkedApp);
                else if (selectedComparison == 'contains' && checkedApp[selectedProperty].includes(Number(comparisonValue))) filteredList.push(checkedApp);
                else if (selectedComparison == '!contains' && !checkedApp[selectedProperty].includes(Number(comparisonValue))) filteredList.push(checkedApp);
                else if (selectedComparison == 'true' && checkedApp[selectedProperty]) filteredList.push(checkedApp);
                else if (selectedComparison == 'false' && !checkedApp[selectedProperty]) filteredList.push(checkedApp);
                else if (selectedProperty == 'in_collection') {
                    let checkedColl = collectionStore.GetCollection(comparisonValue);
                    if (!checkedColl) {
                        const namedCollList = collectionStore.GetUserCollectionsByName(comparisonValue);
                        if (namedCollList.length > 0)
                            checkedColl = namedCollList[0];
                    }

                    if (checkedColl) {
                        const foundInColl = (checkedColl.allApps.some((x: any) => x.appid == checkedApp.appid));
                        if (selectedComparison == 'true' && foundInColl) filteredList.push(checkedApp);
                        else if (selectedComparison == 'false' && !foundInColl) filteredList.push(checkedApp);
                        else console.log("[steam-collections-plus] Bad comparison operator");
                    } else {
                        console.log("[steam-collections-plus] Collection does not exist");
                    }
                } else console.log("[steam-collections-plus] Bad comparison operator");
            }
            setCurrentAppList(filteredList);
        };

        const DoBulkOps = async () => {
            if (selectedBulkOps == 'add') {
                collectionStore.AddOrRemoveApp(currentAppList.map(app => app.appid), true, managedCollectionID);
            } else if (selectedBulkOps == 'remove') {
                collectionStore.AddOrRemoveApp(currentAppList.map(app => app.appid), false, managedCollectionID);
            } else if (selectedBulkOps == 'new') {
                const newColl = collectionStore.NewUnsavedCollection(bulkOpsTarget, undefined, currentAppList);
                await newColl.Save();
            } else {
                console.log("[steam-collections-plus] Bad bulk option")
            }
        };

        useEffect(() => {
            setManagedCollectionID(props.collID);
            setManagedCollectionName(collectionStore.GetCollection(props.collID).m_strName);
        }, []);

        return (
            <ModalRoot closeModal={() => {}}>
                <span style={{textTransform: "uppercase"}}><b>{managedCollectionName} ({managedCollectionID})</b></span> <br />
                <br />
                <div style={lineStyle}>
                    <div style={itemStyle}>
                        <span>Source:</span>
                        <Dropdown rgOptions={sourceOptions} selectedOption={selectedSource} onChange={async (option: { data: string; label: string }) => {setSelectedSource(option.data)}} />
                    </div>
                    <div style={itemStyleLong}>
                        <span>Property:</span>
                        <Dropdown rgOptions={propertyOptions} selectedOption={selectedProperty} onChange={async (option: { data: string; label: string }) => {setSelectedProperty(option.data)}} />
                    </div>
                    <div style={itemStyle}>
                        <span>Comparison:</span>
                        <Dropdown rgOptions={comparisonOptions} selectedOption={selectedComparison} onChange={async (option: { data: string; label: string }) => {setSelectedComparison(option.data)}} />
                    </div>
                    <div style={itemStyle}>
                        <span>Value:</span>
                        <TextField style={{ width: "100%", boxSizing: "border-box" }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setComparisonValue(e.currentTarget.value); }} />
                    </div>
                    <div style={itemStyle}>
                        <DialogButton onClick={DoFiltering}>FILTER</DialogButton>
                    </div>
                </div>
                <br />
                <div style={lineStyle}>
                    <div style={itemStyle}>
                        <span>Current Filtered List:</span>
                    </div>
                    <div style={itemStyle}>
                        <Dropdown rgOptions={bulkOpsOptions} selectedOption={selectedBulkOps} onChange={async (option: { data: string; label: string }) => {setSelectedBulkOps(option.data)}} />
                    </div>
                    <div style={itemStyle}>
                        <TextField style={{ width: "100%", boxSizing: "border-box" }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setBulkOpsTarget(e.currentTarget.value); }} />
                    </div>
                    <div style={itemStyle}>
                        <DialogButton onClick={DoBulkOps}>GO!</DialogButton>
                    </div>
                </div>
                <div style={{
                        width: "90%",
                        height: "500px",
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        padding: "8px",
                        border: "1px solid #444"
                    }}
                >
                    {currentAppList.map(app =>
                        <span>{app.display_name}<br/></span>
                    )}
                </div>
            </ModalRoot>
        );
    };
}

async function OnPopupCreation(popup: any) {
    await sleep(10000);
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

        MainWindowBrowserManager.m_browser.on("finished-request", async (currentURL: any, previousURL: any) => {
            void currentURL;
            void previousURL;

            if (MainWindowBrowserManager.m_lastLocation.pathname === "/library/collections") {
                const folderList = get_folder_list();
                const folderMap = get_folder_map();

                const collGrid = await WaitForElement(`div.${findModule(e => e.CSSGrid).CSSGrid}`, popup.m_popup.document);
                if (collGrid) {
                    var currentPath = "root";

                    // Prevent UI duplication
                    if (collGrid.parentElement!.parentElement!.parentElement!.parentElement!.querySelector("div.steam-collections-plus-path")) {
                        return;
                    }

                    // Switch folder
                    const switchPath = async (newPath: string) => {
                        const allItemsList = collGrid.querySelectorAll(":scope > div[data-itempath]");
                        for (let i = 0; i < allItemsList.length; i++) {
                            if ((allItemsList[i] as HTMLElement).dataset.itempath === newPath) {
                                (allItemsList[i] as HTMLElement).style.display = "";
                            } else {
                                (allItemsList[i] as HTMLElement).style.display = "none";
                            }
                        }

                        const titlePathElement = collGrid.parentElement!.parentElement!.parentElement!.parentElement!.querySelector("div.steam-collections-plus-path");
                        const prettyPath = ": " + newPath.replaceAll("/", " ≫ ");
                        titlePathElement!.textContent = prettyPath;

                        currentPath = newPath;
                    };

                    if (folderList.length > 0) {
                        const collItemList = collGrid.querySelectorAll(`:scope > div[role='row']`);
                        for (let i = 0; i < collItemList.length; i++) {
                            (collItemList[i] as HTMLElement).style.display = "none";
                        }
                    }

                    // Tag all collections on the UI with an itempath
                    const tagCollectionItems = async () => {
                        const collItemList = collGrid.querySelectorAll(`:scope > div > div > div:not(.${findModule(e => e.NewCollection).NewCollection})`);
                        for (let i = 0; i < collItemList.length; i++) {
                            const collName = collItemList[i].querySelector(`div.${findModule(e => e.CollectionLabel).CollectionLabel} > div:not(.${findModule(e => e.CollectionLabelCount).CollectionLabelCount})`)!.textContent;
                            console.log("[steam-collections-plus] Processing collection", collName);

                            var collID = "type-music";
                            const collObj = collectionStore.GetUserCollectionsByName(collName);
                            if (collObj.length > 0) {
                                collID = collObj[0].m_strId;
                            }

                            const imageData = await get_coll_image(collID);
                            if (imageData !== "") {
                                (collItemList[i].querySelector(`div.${findModule(e => e.DisplayCaseContainerBounds).DisplayCaseContainerBounds}`) as HTMLElement)!.style.display = "none";
                                (collItemList[i].querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundImage = `url(${imageData})`;
                                (collItemList[i].querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundSize = "cover";
                                (collItemList[i].querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundPosition = "center";
                                const tintElement = collItemList[i].querySelector(`div.${findModule(e => e.BackgroundImage).BackgroundImage}`);
                                if (tintElement) {
                                    tintElement.remove();
                                }
                            }

                            (collItemList[i] as HTMLElement).dataset.collectionid = collID;
                            if (collID in folderMap) {
                                (collItemList[i] as HTMLElement).dataset.itempath = folderMap[collID];
                            } else {
                                (collItemList[i] as HTMLElement).dataset.itempath = "root";
                            }
                        }
                    };
                    
                    // Add Collection items to the UI, incl. itempath
                    const addCollectionItem = async (templateCollection: Node, currentCollId: string, currentCollName: string, currentCollContains: number) => {
                        console.log("[steam-collections-plus] Processing collection", currentCollName);

                        const newCollItem = templateCollection.cloneNode(true) as HTMLElement;
                        newCollItem.querySelector(`div.${findModule(e => e.CollectionLabel).CollectionLabel} > div:not(.Focusable)`)!.textContent = currentCollName;
                        newCollItem.querySelector(`div.${findModule(e => e.CollectionLabel).CollectionLabel} > div.Focusable > div`)!.textContent = currentCollContains.toString();

                        const imageData = await get_coll_image(currentCollId);
                        if (imageData !== "") {
                            (newCollItem.querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundImage = `url(${imageData})`;
                            (newCollItem.querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundSize = "cover";
                            (newCollItem.querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundPosition = "center";
                        }

                        newCollItem.dataset.collectionid = currentCollId;
                        if (currentCollId in folderMap) {
                            newCollItem.dataset.itempath = folderMap[currentCollId];
                        } else {
                            newCollItem.dataset.itempath = "root";
                        }
                        collGrid.appendChild(newCollItem);

                        newCollItem.addEventListener("click", async () => {
                            SteamUIStore.Navigate(`/library/collection/${currentCollId}`);
                        });
                        
                        newCollItem.addEventListener("contextmenu", async () => {
                            showContextMenu(
                                <Menu label="Collections+ Collection Options">
                                    <MenuItem onClick={async () => {
                                        await collectionStore.DeleteCollection(currentCollId);
                                        newCollItem.remove();

                                        console.log("[steam-collections-plus] Deleted collection", currentCollId);
                                    }}> Delete collection </MenuItem>

                                    <MenuItem onClick={async () => {
                                        const inputFileElement = popup.m_popup.document.createElement("input");
                                        inputFileElement.type = "file";
                                        inputFileElement.style.display = "none";
                                        inputFileElement.addEventListener('change', (e: Event) => {
                                            if ((e.target as HTMLInputElement)!.files) {
                                                console.log((e.target as HTMLInputElement)!.files![0]);
                                                const imageFile = (e.target as HTMLInputElement)!.files![0];
                                                if (imageFile) {
                                                    const reader = new FileReader();
                                                    reader.onload = async (f) => {
                                                        void f;
                                                        const imageData = reader.result;
                                                        await set_coll_image(currentCollId, imageData as string);

                                                        (newCollItem.querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundImage = `url(${imageData})`;
                                                        (newCollItem.querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundSize = "cover";
                                                        (newCollItem.querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundPosition = "center";

                                                        console.log("[steam-collections-plus] Image set for", currentCollId);
                                                    };
                                                    reader.readAsDataURL(imageFile);
                                                }
                                            }
                                            inputFileElement.remove();
                                        });
                                        newCollItem.appendChild(inputFileElement);
                                        inputFileElement.click();
                                    }}> Set collection image </MenuItem>

                                    <MenuItem onClick={async () => {
                                        await set_coll_image(currentCollId, "");
                                        (newCollItem.querySelector(`div.${findModule(e => e.CollectionImage).CollectionImage}`) as HTMLElement)!.style.backgroundImage = "";

                                        console.log("[steam-collections-plus] Image reset for", currentCollId);
                                    }}> Reset collection image </MenuItem>
                                </Menu>,
                                newCollItem,
                                { bForcePopup: true }
                            );
                        });
                    };

                    if (folderList.length > 0) {
                        const existingCollection = collGrid.querySelector(`:scope > div > div > div:not(.${findModule(e => e.NewCollection).NewCollection})`);
                        const templateCollection = existingCollection!.cloneNode(true);
                        const templateTint = (templateCollection as HTMLElement).querySelector(`div.${findModule(e => e.BackgroundImage).BackgroundImage}`);
                        if (templateTint) {
                            templateTint.remove();
                        }
                        const templatePreview = (templateCollection as HTMLElement).querySelector(`div.${findModule(e => e.DisplayCaseContainerBounds).DisplayCaseContainerBounds}`);
                        if (templatePreview) {
                            templatePreview.remove();
                        }
                        
                        for (let i = 0; i < collectionStore.userCollections.length; i++) {
                            const currentCollId = collectionStore.userCollections[i].m_strId;
                            const currentCollName = collectionStore.userCollections[i].m_strName;
                            const currentCollContains = collectionStore.userCollections[i].allApps.length;
                            await addCollectionItem(templateCollection, currentCollId, currentCollName, currentCollContains);
                        }
                    } else {
                        await tagCollectionItems();
                    }

                    // Add folder items to the UI, incl. itempath
                    const addFolderItem = async (templateItem: Element, folderFullPath: string) => {
                        const folderPath = folderFullPath.substring(0, folderFullPath.lastIndexOf("/"));
                        const folderName = folderFullPath.substring(folderFullPath.lastIndexOf("/") + 1);

                        const folderItem = templateItem.cloneNode(true) as HTMLElement;
                        folderItem.querySelector(`div.${findModule(e => e.BigPlus).BigPlus}`)!.innerHTML = "📁";
                        folderItem.querySelector(`div.${findModule(e => e.CollectionLabel).CollectionLabel}`)!.textContent = folderName;
                        folderItem.dataset.itempath = folderPath;
                        collGrid.insertBefore(folderItem, templateItem.nextSibling);

                        const imageData = await get_folder_image(folderFullPath);
                        if (imageData !== "") {
                            folderItem.style.backgroundImage = `url(${imageData})`;
                            folderItem.style.backgroundSize = "cover";
                            folderItem.style.backgroundPosition = "center";
                        }

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
                                        remove_folder(folderFullPath);
                                        folderItem.remove();

                                        // Remove subfolders from UI
                                        const allFolderItems = collGrid.querySelectorAll(`:scope > div.${findModule(e => e.NewCollection).NewCollection}`);
                                        for (let j = 0; j < allFolderItems.length; j++) {
                                            if ((allFolderItems[j] as HTMLElement).dataset.itempath!.startsWith(`${folderFullPath}/`)) {
                                                allFolderItems[j].remove();
                                            }
                                        }

                                        // Re-tag collections
                                        const allCollectionItems = collGrid.querySelectorAll(`:scope > div:not(.${findModule(e => e.NewCollection).NewCollection})`);
                                        for (let j = 0; j < allCollectionItems.length; j++) {
                                            if ((allCollectionItems[j] as HTMLElement).dataset.itempath === folderFullPath || (allCollectionItems[j] as HTMLElement).dataset.itempath!.startsWith(`${folderFullPath}/`)) {
                                                (allCollectionItems[j] as HTMLElement).dataset.itempath = "root";
                                            }
                                        }

                                        // Show moved collections if we are in root
                                        switchPath(currentPath);
                                    }}> Delete folder </MenuItem>

                                    <MenuItem onClick={async () => {
                                        const inputFileElement = popup.m_popup.document.createElement("input");
                                        inputFileElement.type = "file";
                                        inputFileElement.style.display = "none";
                                        inputFileElement.addEventListener('change', (e: Event) => {
                                            if ((e.target as HTMLInputElement)!.files) {
                                                console.log((e.target as HTMLInputElement)!.files![0]);
                                                const imageFile = (e.target as HTMLInputElement)!.files![0];
                                                if (imageFile) {
                                                    const reader = new FileReader();
                                                    reader.onload = async (f) => {
                                                        void f;
                                                        const imageData = reader.result;
                                                        await set_folder_image(folderFullPath, imageData as string);

                                                        folderItem.style.backgroundImage = `url(${imageData})`;
                                                        folderItem.style.backgroundSize = "cover";
                                                        folderItem.style.backgroundPosition = "center";

                                                        console.log("[steam-collections-plus] Image set for", folderFullPath);
                                                    };
                                                    reader.readAsDataURL(imageFile);
                                                }
                                            }
                                            inputFileElement.remove();
                                        });
                                        folderItem.appendChild(inputFileElement);
                                        inputFileElement.click();
                                    }}> Set folder image </MenuItem>

                                    <MenuItem onClick={async () => {
                                        await set_folder_image(folderFullPath, "");

                                        folderItem.style.backgroundImage = "";

                                        console.log("[steam-collections-plus] Image reset for", folderFullPath);
                                    }}> Reset folder image </MenuItem>
                                </Menu>,
                                folderItem.querySelector(`div.${findModule(e => e.BigPlus).BigPlus}`)!,
                                { bForcePopup: true }
                            );
                        });
                    };

                    const templateItem = collGrid.querySelector(`:scope > div > div > div.${findModule(e => e.NewCollection).NewCollection}`);
                    (templateItem as HTMLElement).dataset.itempath = "root";
                    for (let i = 0; i < folderList.length; i++) {
                        const folderFullPath = folderList[i];
                        addFolderItem(templateItem!, folderFullPath);
                    }

                    // Add new UI elements
                    const oldTitlePathElement = collGrid.querySelector("div.steam-collections-plus-path");
                    if (!oldTitlePathElement) {
                        const titleTextElement = collGrid.parentElement!.parentElement!.parentElement!.parentElement!.firstChild!.firstChild;
                        const titlePathElement = titleTextElement!.cloneNode(true) as HTMLElement;
                        titlePathElement.classList.add("steam-collections-plus-path");
                        titlePathElement.textContent = ": root";
                        titleTextElement!.parentElement!.insertBefore(titlePathElement, titleTextElement!.nextSibling);

                        // Go to parent folder
                        const upElement = titleTextElement!.cloneNode(true);
                        upElement.textContent = "[UP]";
                        titleTextElement!.parentElement!.insertBefore(upElement, titleTextElement);

                        upElement.addEventListener("click", async () => {
                            // Leave folder
                            if (currentPath !== "root") {
                                const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
                                switchPath(parentPath);
                            }
                        });

                        // Manage current folder
                        const cPlusElement = titleTextElement!.cloneNode(true);
                        cPlusElement.textContent = "[C+]";
                        titleTextElement!.parentElement!.insertBefore(cPlusElement, titleTextElement);

                        cPlusElement.addEventListener("click", async () => {
                            const FolderManagementComponent: React.FC = (props) => {
                                void props;

                                type CollectionStateList = {
                                    collectionID: string;
                                    collectionName: string;
                                    collectionFolder: string;
                                };
                                const [managedFolderName, setManagedFolderName] = useState<string>("root");
                                const [collectionStateList, setCollectionStateList] = useState<CollectionStateList[]>([]);

                                // Get current data
                                const GetCurrentSettings = async () => {
                                    setManagedFolderName(currentPath.substring(currentPath.lastIndexOf("/") + 1));

                                    let wipStateList = [];
                                    const latestFolderMap = get_folder_map();
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
                                const AddNewFolder = async (e: React.MouseEvent<HTMLButtonElement>) => {
                                    const newFolderPath = currentPath + "/" + ((e.target as HTMLElement).parentElement!.querySelector("#newFolderName") as HTMLInputElement)!.value;
                                    const successfulAdd = add_folder(newFolderPath);
                                    if (successfulAdd) {
                                        addFolderItem(templateItem!, newFolderPath);
                                        switchPath(currentPath);
                                    }
                                };

                                // Add and remove collections to/from folder
                                const ApplyCollectionSelection = async (e: React.MouseEvent<HTMLButtonElement>) => {
                                    console.log("[steam-collections-plus] Applying selection...");
                                    
                                    const allCheckboxes = (e.target as HTMLElement).parentElement!.querySelectorAll("input[type=checkbox]");
                                    for (let i = 0; i < allCheckboxes.length; i++) {
                                        const collID = (allCheckboxes[i] as HTMLElement).dataset.collectionid;
                                        if (!(allCheckboxes[i] as HTMLInputElement).checked && (allCheckboxes[i] as HTMLElement).dataset.incurrentfolder === "true") {
                                            // Remove collection from current folder
                                            console.log(`[steam-collections-plus] Removing ${collID} from`, currentPath);
                                            set_folder(collID!, "root");
                                            (collGrid.querySelector(`:scope > div[data-collectionid="${collID}"]`) as HTMLElement)!.dataset.itempath = "root";
                                        } else if ((allCheckboxes[i] as HTMLInputElement).checked && (allCheckboxes[i] as HTMLElement).dataset.incurrentfolder === "false") {
                                            // Add collection to current folder
                                            console.log(`[steam-collections-plus] Moving ${collID} to`, currentPath);
                                            set_folder(collID!, currentPath);
                                            (collGrid.querySelector(`:scope > div[data-collectionid="${collID}"]`) as HTMLElement)!.dataset.itempath = currentPath;
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
                                                    <label htmlFor={`coll-chkbox-${index}`}>{collectionData.collectionName} (Currently in {collectionData.collectionFolder})</label>
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

                    const collListObserver = new MutationObserver(async (mutationList, observer) => {
                        void observer;
                        if (folderList.length > 0) {
                            for (const record of mutationList) {
                                for (const addedNode of record.addedNodes) {
                                    //b
                                    if ((addedNode as HTMLElement).role === "row") {
                                        (addedNode as HTMLElement).style.display = "none";
                                    }
                                }
                            }
                        } else {
                            await tagCollectionItems();
                            switchPath(currentPath);
                        }
                    });
                    collListObserver.observe(collGrid, { childList: true });

                    switchPath("root");
                }
            } else if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/collection/")) {
                const collOptionsDiv = await WaitForElement(`div.${findModule(e => e.CollectionOptions).CollectionOptions}`, popup.m_popup.document);
                const oldCPlusButton = collOptionsDiv.querySelector('button.collectionsplus-button');
                if (!oldCPlusButton) {
                    const cPlusButton = popup.m_popup.document.createElement("div");
                    const cPlusButtonRoot = createRoot(cPlusButton);
                    cPlusButtonRoot.render(<DialogButton className="collectionsplus-button" style={{width: "40px", marginLeft: "3px", marginRight: "3px"}}>C+</DialogButton>);
                    collOptionsDiv.insertBefore(cPlusButton, collOptionsDiv.firstChild!.nextSibling);

                    cPlusButton.addEventListener("click", async () => {
                        showContextMenu(
                            <Menu label="Collections+ Options">
                                <MenuItem onClick={async () => {
                                    const BulkUIComponent = getBulkUIComponent(popup);

                                    showModal(
                                        <BulkUIComponent key={uiStore.currentGameListSelection.strCollectionId} collID={uiStore.currentGameListSelection.strCollectionId} />,
                                        popup.m_popup.window, {strTitle: "Bulk operations", bHideMainWindowForPopouts: false, bForcePopOut: true, popupHeight: 700, popupWidth: 1500}
                                    );
                                }}> Bulk operations </MenuItem>

                                <MenuItem onClick={async () => {
                                    const inputFileElement = popup.m_popup.document.createElement("input");
                                    inputFileElement.type = "file";
                                    inputFileElement.style.display = "none";
                                    inputFileElement.addEventListener('change', (e: Event) => {
                                        if ((e.target as HTMLInputElement)!.files) {
                                            console.log((e.target as HTMLInputElement)!.files![0]);
                                            const imageFile = (e.target as HTMLInputElement)!.files![0];
                                            if (imageFile) {
                                                const reader = new FileReader();
                                                reader.onload = async (f) => {
                                                    void f;

                                                    const imageData = reader.result;
                                                    await set_coll_image(uiStore.currentGameListSelection.strCollectionId, imageData as string);

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
                                    await set_coll_image(uiStore.currentGameListSelection.strCollectionId, "");

                                    console.log("[steam-collections-plus] Image reset for", uiStore.currentGameListSelection.strCollectionId);
                                }}> Reset collection image </MenuItem>

                                <MenuItem onClick={async () => {
                                    const currentColl = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId);
                                    const currentAppList = currentColl.allApps;
                                    if (currentAppList.length > 0) {
                                        const randomIndex = Math.floor(Math.random() * currentAppList.length);
                                        SteamClient.Apps.RunGame(currentAppList[randomIndex].appid.toString(), "", 0, 0);
                                    }
                                }}> Start random application </MenuItem>

                                <MenuItem onClick={async () => {
                                    const currentColl = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId);
                                    const currentAppList = currentColl.allApps.filter((x: any) => x.installed);
                                    if (currentAppList.length > 0) {
                                        const randomIndex = Math.floor(Math.random() * currentAppList.length);
                                        SteamClient.Apps.RunGame(currentAppList[randomIndex].appid.toString(), "", 0, 0);
                                    }
                                }}> Start random application (installed only) </MenuItem>

                                <MenuItem onClick={async () => {
                                    const currentColl = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId);
                                    const currentAppList = currentColl.allApps;
                                    if (currentAppList.length > 0) {
                                        const randomIndex = Math.floor(Math.random() * currentAppList.length);
                                        SteamUIStore.Navigate(`/library/app/${currentAppList[randomIndex].appid.toString()}`);
                                    }
                                }}> Show random application </MenuItem>

                                <MenuItem onClick={async () => {
                                    const currentColl = collectionStore.GetCollection(uiStore.currentGameListSelection.strCollectionId);
                                    const currentAppList = currentColl.allApps.filter((x: any) => x.installed);
                                    if (currentAppList.length > 0) {
                                        const randomIndex = Math.floor(Math.random() * currentAppList.length);
                                        SteamUIStore.Navigate(`/library/app/${currentAppList[randomIndex].appid.toString()}`);
                                    }
                                }}> Show random application (installed only) </MenuItem>
                            </Menu>,
                            cPlusButton,
                            { bForcePopup: true }
                        );
                    });
                }
            } else if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/app/")) {
                const gameSettingsButton = await WaitForElement(`div.${findModule(e => e.InPage).InPage} div.${findModule(e => e.AppButtonsContainer).AppButtonsContainer} > div.${findModule(e => e.MenuButtonContainer).MenuButtonContainer}:not([role="button"])`, popup.m_popup.document);
                const oldCPlusButton = gameSettingsButton.parentNode!.querySelector('div.coll-plus-app-button');
                if (!oldCPlusButton) {
                    const cPlusButton = gameSettingsButton.cloneNode(true) as HTMLElement;
                    cPlusButton.classList.add("coll-plus-app-button");
                    cPlusButton.title = "Collections+";
                    (cPlusButton.firstChild as HTMLElement)!.innerHTML = "C+";
                    gameSettingsButton.parentNode!.insertBefore(cPlusButton, gameSettingsButton.nextSibling);

                    cPlusButton.addEventListener("click", async () => {
                        const CollectionManagementComponent: React.FC = (props) => {
                            void props;

                            const treeStyle: React.CSSProperties = {
                                // @ts-ignore: Property exists
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

                            type CollectionStateList = {
                                collectionID: string;
                                collectionName: string;
                                collectionFolder: string;
                                appInColl: boolean;
                            };
                            const [managedAppName, setManagedAppName] = useState<string>("");
                            const [folderList, setFolderList] = useState<FolderList>([]);
                            const [collectionStateList, setCollectionStateList] = useState<CollectionStateList[]>([]);

                            // Get current data
                            const GetCurrentSettings = async () => {
                                const currentApp = appStore.allApps.find((x: any) => x.appid === uiStore.currentGameListSelection.nAppId);
                                setManagedAppName(currentApp.display_name);

                                setFolderList(["root"].concat(get_folder_list()));

                                let wipStateList = [];
                                const latestFolderMap = get_folder_map();
                                for (let i = 0; i < collectionStore.userCollections.length; i++) {
                                    const currentCollID = collectionStore.userCollections[i].m_strId;
                                    if (currentCollID !== "uncategorized") {
                                        const currentCollName = collectionStore.userCollections[i].m_strName;
                                        let currentCollFolder = "root";
                                        if (currentCollID in latestFolderMap) {
                                            currentCollFolder = latestFolderMap[currentCollID];
                                        }
                                        let currentCollContainsApp = false;
                                        if (collectionStore.userCollections[i].allApps.find((x: any) => x.appid === uiStore.currentGameListSelection.nAppId)) {
                                            currentCollContainsApp = true;
                                        }
                                        wipStateList.push({collectionID: currentCollID, collectionName: currentCollName, collectionFolder: currentCollFolder, appInColl: currentCollContainsApp});
                                    }
                                }
                                setCollectionStateList(wipStateList);
                            };

                            // Add and remove collections to/from folder
                            const ApplyCollectionSelection = async (e: React.MouseEvent<HTMLButtonElement>) => {
                                console.log("[steam-collections-plus] Applying selection...");

                                const allCheckboxes = (e.target as HTMLElement).parentElement!.querySelectorAll("input[type=checkbox]");
                                for (let i = 0; i < allCheckboxes.length; i++) {
                                    const collID = (allCheckboxes[i] as HTMLElement).dataset.collectionid;
                                    if (!(allCheckboxes[i] as HTMLInputElement).checked && (allCheckboxes[i] as HTMLElement).dataset.incollection === "true") {
                                        // Remove app from collection
                                        console.log("[steam-collections-plus] Removing app from", collID);
                                        collectionStore.AddOrRemoveApp([uiStore.currentGameListSelection.nAppId], false, collID);
                                        (allCheckboxes[i] as HTMLElement).dataset.incollection = "false";
                                    } else if ((allCheckboxes[i] as HTMLInputElement).checked && (allCheckboxes[i] as HTMLElement).dataset.incollection === "false") {
                                        // Add app to collection
                                        console.log("[steam-collections-plus] Adding app to", collID);
                                        collectionStore.AddOrRemoveApp([uiStore.currentGameListSelection.nAppId], true, collID);
                                        (allCheckboxes[i] as HTMLElement).dataset.incollection = "true";
                                    }
                                }
                            }

                            const GenerateFolderListItem = (folderPath: string) => {
                                return (
                                    <li style={liStyle}>
                                        <details open>
                                            <summary>{folderPath.replaceAll("/", " ≫ ")}</summary>
                                            <ul style={ulStyle}>
                                                {collectionStateList.filter((x) => x.collectionFolder === folderPath).map((collectionData, index) => {
                                                    void index;
                                                    return (
                                                        <li style={liStyle}>
                                                            <input key={collectionData.collectionID} id={`coll-chkbox-${collectionData.collectionID}`} data-collectionid={collectionData.collectionID} data-incollection={collectionData.appInColl} type="checkbox" defaultChecked={collectionData.appInColl} />
                                                            <label htmlFor={`coll-chkbox-${collectionData.collectionID}`}>{collectionData.collectionName}</label>
                                                        </li>
                                                    );
                                                })}
                                                {folderList.filter((x) => x.startsWith(`${folderPath}/`)).filter((x) => !x.includes("/", folderPath.length + 1)).map((childFolderName, index) => { void index; return GenerateFolderListItem(childFolderName); })}
                                            </ul>
                                        </details>
                                    </li>
                                );
                            };

                            useEffect(() => {
                                GetCurrentSettings();
                            }, []);

                            return (
                                <ModalRoot closeModal={() => {}}>
                                    <span style={{textTransform: "uppercase"}}><b>{managedAppName}</b></span> <br />
                                    <br />
                                    Collections: <br />
                                    <ul style={treeStyle}>
                                        {GenerateFolderListItem("root")}
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

export default definePlugin(() => {
    console.log("[steam-collections-plus] Frontend startup");
    
    const rawDBValue = localStorage.getItem("luthor112.steam-collections-plus.colldb");
    const storedDB = rawDBValue ? JSON.parse(rawDBValue) : {};
    if (storedDB) {
        if ("__folderlist" in storedDB) {
            folderList = storedDB["__folderlist"];
            delete storedDB["__folderlist"];
        }
    }
    collDB = { ...collDB, ...storedDB };
    console.log("[steam-collections-plus] CollDB loaded");

    const rawFolderList = localStorage.getItem("luthor112.steam-collections-plus.folderlist");
    const storedFolderList = rawFolderList ? JSON.parse(rawFolderList) : [];
    if (storedFolderList) {
        folderList = storedFolderList;
    }
    console.log("[steam-collections-plus] Folderlist loaded");

    save_coll_db();

    Millennium.AddWindowCreateHook!(OnPopupCreation);
    
    return {
		title: "Collections+",
		icon: <IconsModule.Settings />,
	};
});
