import Millennium, PluginUtils # type: ignore
logger = PluginUtils.Logger()

import json
import os

coll_db = {}

########
# UTIL #
########

def get_art_dir():
    return os.path.join(PLUGIN_BASE_DIR, "artcache")

def get_coll_db_fname():
    return os.path.join(PLUGIN_BASE_DIR, "coll_db.json")

def load_coll_db():
    global coll_db
    if os.path.exists(get_coll_db_fname()):
        with open(get_coll_db_fname(), "rt") as fp:
            coll_db = json.load(fp)

def save_coll_db():
    global coll_db
    with open(get_coll_db_fname(), "wt") as fp:
        json.dump(coll_db, fp)

def get_encoded_image(fname):
    with open(fname, "rt") as fp:
        return fp.read()

def save_encoded_image(fname, fdata):
    with open(fname, "wt") as fp:
        fp.write(fdata)

###########
# DB UTIL #
###########

def db_get_image(coll_id):
    global coll_db
    if coll_id in coll_db:
        if "image" in coll_db[coll_id]:
            fname = os.path.join(get_art_dir(), coll_id)
            if coll_db[coll_id]["image"] and os.path.exists(fname):
                return get_encoded_image(fname)
    return ""

def db_save_image(coll_id, image_data):
    global coll_db
    if coll_id not in coll_db:
        coll_db[coll_id] = {}

    if image_data != "":
        fname = os.path.join(get_art_dir(), coll_id)
        save_encoded_image(fname, image_data)
        coll_db[coll_id]["image"] = True
    else:
        coll_db[coll_id]["image"] = False
    save_coll_db()

def db_get_last(coll_id, op_type):
    global coll_db
    if coll_id in coll_db:
        if op_type in coll_db[coll_id]:
            return coll_db[coll_id][op_type]
    return ""

def db_set_last(coll_id, op_type, op_data):
    global coll_db
    if coll_id not in coll_db:
        coll_db[coll_id] = {}

    coll_db[coll_id][op_type] = op_data
    save_coll_db()

def db_get_folder(coll_id):
    global coll_db
    if coll_id in coll_db:
        if "folder" in coll_db[coll_id]:
            return coll_db[coll_id]["folder"]
    return "root"

def db_set_folder(coll_id, folder_path):
    global coll_db
    if coll_id not in coll_db:
        coll_db[coll_id] = {}

    coll_db[coll_id]["folder"] = folder_path
    save_coll_db()

def db_get_folder_list():
    global coll_db
    if "__folderlist" in coll_db:
        return coll_db["__folderlist"]
    return []

def db_get_folder_map():
    global coll_db
    folder_map = {}
    for coll_id, coll_data in coll_db.items():
        if coll_id == "__folderlist":
            continue

        coll_folder = "root"
        if "folder" in coll_data:
            coll_folder = coll_data["folder"]
        folder_map[coll_id] = coll_folder
    return folder_map

def db_add_folder(folder_path):
    global coll_db
    if "__folderlist" not in coll_db:
        coll_db["__folderlist"] = []

    if folder_path not in coll_db["__folderlist"]:
        coll_db["__folderlist"].append(folder_path)
        coll_db["__folderlist"].sort()
        save_coll_db()
        return True
    return False

def db_remove_folder(folder_path):
    global coll_db
    if "__folderlist" not in coll_db:
        coll_db["__folderlist"] = []

    new_folderlist = []
    for current_folder_path in coll_db["__folderlist"]:
        if not current_folder_path == folder_path and not current_folder_path.startswith(f"{folder_path}/"):
            new_folderlist.append(current_folder_path)
    coll_db["__folderlist"] = new_folderlist

    for coll_id, coll_data in coll_db.items():
        if coll_id == "__folderlist":
            continue

        if "folder" in coll_data:
            if coll_data["folder"] == folder_path or coll_data["folder"].startswith(f"{folder_path}/"):
                coll_data["folder"] = "root"

    save_coll_db()

##############
# INTERFACES #
##############

class Backend:
    @staticmethod
    def get_coll_image(coll_id):
        logger.log(f"get_coll_image() called for collection {coll_id}")
        return db_get_image(coll_id)

    @staticmethod
    def set_coll_image(coll_id, image_data):
        logger.log(f"set_coll_image() called for collection {coll_id}")
        db_save_image(coll_id, image_data)
        return True

    @staticmethod
    def get_last_filter(coll_id, op_type):
        last_filter = db_get_last(coll_id, op_type)
        logger.log(f"get_last_filter({coll_id}, {op_type}) -> {last_filter}")
        return last_filter

    @staticmethod
    def set_last_filter(coll_id, op_type, op_data):
        logger.log(f"set_last_filter() called for collection {coll_id} with type {op_type} and data {op_data}")
        db_set_last(coll_id, op_type, op_data)
        return True

    @staticmethod
    def get_folder(coll_id):
        coll_folder = db_get_folder(coll_id)
        logger.log(f"get_folder({coll_id}) -> {coll_folder}")
        return coll_folder

    @staticmethod
    def set_folder(coll_id, folder_path):
        logger.log(f"set_folder() called for collection {coll_id} with path {folder_path}")
        db_set_folder(coll_id, folder_path)
        return True

    @staticmethod
    def get_folder_list():
        logger.log("get_folder_list() called")
        return json.dumps(db_get_folder_list())

    @staticmethod
    def get_folder_map():
        logger.log("get_folder_map() called")
        return json.dumps(db_get_folder_map())

    @staticmethod
    def add_folder(folder_path):
        logger.log(f"add_folder() called with path {folder_path}")
        return db_add_folder(folder_path)

    @staticmethod
    def remove_folder(folder_path):
        logger.log(f"remove_folder() called with path {folder_path}")
        db_remove_folder(folder_path)
        return True

class Plugin:
    def _front_end_loaded(self):
        logger.log("Frontend loaded")

    def _load(self):
        logger.log(f"Plugin base dir: {PLUGIN_BASE_DIR}")

        art_dir = get_art_dir()
        if not os.path.exists(art_dir):
            logger.log("Creating art dir...")
            os.mkdir(art_dir)
        logger.log(f"Art dir: {art_dir}")

        load_coll_db()
        logger.log("Database loaded")

        logger.log("Backend loaded")
        Millennium.ready()

    def _unload(self):
        save_coll_db()
        logger.log("Database saved")
        logger.log("Unloading")
