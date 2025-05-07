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
