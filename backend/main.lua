local logger = require("logger")
local millennium = require("millennium")
local fs = require("fs")
local utils = require("utils")

local function get_art_dir()
    local plugin_dir = fs.parent_path(MILLENNIUM_PLUGIN_SECRET_BACKEND_ABSOLUTE)
    return fs.join(plugin_dir, "artcache")
end

-- INTERFACES

function get_encoded_image(filename)
    local full_fname = fs.join(get_art_dir(), filename)
    logger:info("Trying to load image " .. full_fname)
    if fs.exists(full_fname) then
        logger:info("File exists, returning content...")
        return utils.read_file(full_fname)
    else
        logger:info("File does not exist.")
    end
    return ""
end

function save_encoded_image(a_filename, b_filedata)
    local filename = a_filename
    local filedata = b_filedata

    local full_fname = fs.join(get_art_dir(), filename)
    logger:info("Storing image " .. full_fname)
    utils.write_file(full_fname, filedata)
    return true
end

-- PLUGIN MANAGEMENT

local function on_frontend_loaded()
    logger:info("Frontend loaded")
end

local function on_load()
    local art_dir = get_art_dir()
    if not fs.exists(art_dir) then
        logger:info("Creating art dir...")
        fs.create_directory(art_dir)
    end
    logger:info("Art dir: " .. art_dir)

    logger:info("Backend loaded")
    millennium.ready()
end

local function on_unload()
    logger:info("Backend unloaded")
end

return {
    on_frontend_loaded = on_frontend_loaded,
    on_load = on_load,
    on_unload = on_unload
}
