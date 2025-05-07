import { callable, findModule, Millennium, Menu, MenuItem, showContextMenu } from "@steambrew/client";

// Backend functions
const get_coll_image = callable<[{ coll_id: string }], string>('Backend.get_coll_image');
const set_coll_image = callable<[{ coll_id: string, image_data: string }], boolean>('Backend.set_coll_image');
const get_last_filter = callable<[{ coll_id: string, op_type: string }], string>('Backend.get_last_filter');
const set_last_filter = callable<[{ coll_id: string, op_type: string, op_data: string }], boolean>('Backend.set_last_filter');

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];

const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

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
                const collGrid = await WaitForElement(`div.${findModule(e => e.CSSGrid).CSSGrid}`, popup.m_popup.document);
                if (collGrid) {
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
                    }
                }
            } else if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/collection/")) {
                const collOptionsDiv = await WaitForElement(`div.${findModule(e => e.CollectionOptions).CollectionOptions}`, popup.m_popup.document);
                const oldCPlusButton = collOptionsDiv.querySelector('div.collectionsplus-button');
                if (!oldCPlusButton) {
                    const cPlusButton = popup.m_popup.document.createElement("div");
                    cPlusButton.className = `${findModule(e => e.MenuButtonContainer).MenuButtonContainer} collectionsplus-button`;
                    cPlusButton.innerHTML = `<div class="${findModule(e => e.GameInfoButton).MenuButton} Focusable" tabindex="0" role="button">C+</div>`;
                    collOptionsDiv.insertBefore(cPlusButton, collOptionsDiv.firstChild.nextSibling);

                    cPlusButton.addEventListener("click", async () => {
                        showContextMenu(
                            <Menu label="Collections+ Options">
                                <MenuItem onClick={async () => {
                                    console.log("[steam-collections-plus] Applications added to", uiStore.currentGameListSelection.strCollectionId);
                                }}> Add applications in bulk </MenuItem>

                                <MenuItem onClick={async () => {
                                    console.log("[steam-collections-plus] Applications removed from", uiStore.currentGameListSelection.strCollectionId);
                                }}> Remove applications in bulk </MenuItem>

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
                            </Menu>,
                            cPlusButton,
                            { bForcePopup: true }
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
