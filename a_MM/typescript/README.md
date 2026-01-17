_This readme has been copied from the [MediaMonkey developer wiki](https://www.mediamonkey.com/wiki/Getting_Started_(Addons)) and has not yet been fully updated with our TypeScript-based changes in MediaMonkey 5._

# Additional Links

-   The [**Developer Forum pinned
    post**](https://www.mediamonkey.com/forum/viewtopic.php?f=27&t=81285)
    provides a summary of the information provided here, plus a few
    additional notes.
-   **[Working with Native Objects &
    Data](https://www.mediamonkey.com/wiki/Working_with_Native_Objects_%26_Data)** covers the
    concepts of data sources and native objects.
-   The [**MM5 Developer
    Forum**](https://www.mediamonkey.com/forum/viewforum.php?f=27) is
    where you can find and ask questions related to developing MM5
    addons.
-   The [**Skinning
    Guide**](https://www.mediamonkey.com/wiki/Skinning_Guide) provides
    information on how to create skins.
-   [**Controlling MM5 from External Applications**](https://www.mediamonkey.com/wiki/Controlling_MM5_from_External_Applications) 
    discusses the different methods of controlling MediaMonkey 5 from
    other applications.

# Introduction to Making Addons in MediaMonkey 5

MediaMonkey 5 is a fully HTML-based desktop application which uses
Chromium for rendering. This means that the entire UI is driven by a
**platform-independent** HTML/CSS/JS stack, which is fully accessible to
developers and skinners. JS in cooperation with native code drives the
non-visual aspects, also fully controllable by developers. This gives
unprecedented customization options to create beautiful skins, new or
enhanced functionality and great addons in general.

Scripting in MediaMonkey 5 differs greatly from MediaMonkey 4 and below,
because it has been designed from the ground-up. It is not difficult to
learn, especially if you are familiar with web programming. If you are
coming from writing MediaMonkey 4 addons, you will get adjusted in no
time at all.

# Hello World example 

Here is a basic Hello World example for a MediaMonkey 5 addon.

Inside a new folder, create a file named info.json with the essential
information about your addon.

``` javascript
{
    "title": "My First Addon",
    "id": "myFirstAddon",
    "description": "Hello world!",
    "version": "1.0.0",
    "type": "general",
    "author": "Jane Doe"
}
```

Next, create a file named mainwindow_add.js. This code will get added to
the end of mainwindow.js, and it will run when MediaMonkey starts.

``` javascript
// Execute when the window is ready
window.whenReady(() => {
    uitools.toastMessage.show('Hello world!', {
        disableUndo: true
    });
});
```

Then, select your two files and package them into a zip. Make sure that
they are in the root of your zip archive and not inside a subfolder.
Rename it to myFirstAddon.mmip.

Inside MediaMonkey5, go to Tools \> Addons, click Add, and select your
addon. After it installs and you reload the window, you will get a popup
\"toast\" message on the bottom of the screen.

# MMIP (MediaMonkey Installer Packages)

The center of all MediaMonkey add-ons is the MMIP. There is nothing
special about the file format itself; it is just a ZIP archive with a
different filename. You can use any standard method to zip the files,
and then just rename it to a .mmip file.

If you wish to automate the process of zipping the MMIP packages, you
are in luck.

-   There is a tool named pack-mmip which allows you to automatically
    package MMIPs from the command line. It is available here:
    <https://github.com/JL102/pack-mmip>
-   If your code is on Github, you can use a pipeline to automatically
    package your addon whenever you commit changes:
    <https://www.mediamonkey.com/forum/viewtopic.php?p=476534>

## Folder Structure

### Metadata (info.json)

At the root of an MMIP, there must be a file named info.json. It
includes all essential information about the addon. It cannot be in a
subfolder.

Here is an example info.json:

``` javascript
{
    "title": "My Addon Name",
    "id": "myFirstAddon",
    "description": "This is my first addon!",
    "version": "1.0.0",
    "minAppVersion": "5.0.0",
    "type": "general",
    "author": "Jane Doe",
    "icon": "icon.png"
}
```

Here are the possible attributes info.json can contain:


```
+-------------------+-----------+------------------------------------+
| Attribute         | Required? | Information                        |
+===================+===========+====================================+
| title             | **yes**   | This is the name of your addon     |
|                   |           | that is visible to the user.       |
+-------------------+-----------+------------------------------------+
| id                | **yes**   | This is the unique ID of your      |
|                   |           | addon. It does not have to be      |
|                   |           | identical to your title, but it is |
|                   |           | recommended that your addon\'s id  |
|                   |           | be similar to its title for        |
|                   |           | organizational purposes. The id    |
|                   |           | can include the following          |
|                   |           | characters: \[a-zA-Z0-9 -\_\'()\]. |
|                   |           | As of 5.0.3, this format will be   |
|                   |           | enforced. We recommend sticking to |
|                   |           | an alphanumeric string without     |
|                   |           | spaces.                            |
+-------------------+-----------+------------------------------------+
| description       | **yes**   | The description of your addon.     |
|                   |           | Make sure your description is      |
|                   |           | brief, yet conveys the meaning and |
|                   |           | usage of your addon to the user.   |
|                   |           | You can create line breaks in the  |
|                   |           | description with \\n.              |
+-------------------+-----------+------------------------------------+
| version           | **yes**   | The version number of your addon.  |
|                   |           | It must be in the format %d.%d.%d, |
|                   |           | which is three period-separated    |
|                   |           | numbers.                           |
+-------------------+-----------+------------------------------------+
| minAppVersion     | no\*      | The minimum compatible version of  |
|                   |           | MediaMonkey for your addon. Please |
|                   |           | consult                            |
|                   |           | [Methods_Added_Post_5.0](          |
|                   |           | https://www.mediamonkey.com/wiki/Methods_Added_Post_5.0) |
|                   |           | to view whether your addon is      |
|                   |           | incompatible with older versions   |
|                   |           | of MediaMonkey.                    |
+-------------------+-----------+------------------------------------+
| type              | no        | The category of your addon. The    |
|                   |           | existing categories are: general,  |
|                   |           | skin, layout, sync, metadata, and  |
|                   |           | visualization; but you can create  |
|                   |           | your own categories. If            |
|                   |           | unspecified, the type defaults to  |
|                   |           | general.                           |
+-------------------+-----------+------------------------------------+
| author            | no        | The name of the addon\'s author.   |
+-------------------+-----------+------------------------------------+
| icon              | no        | The filename of your addon\'s icon |
|                   |           | image. The image file must be in   |
|                   |           | the root of the MMIP.              |
+-------------------+-----------+------------------------------------+
| config            | no        | The filename of your addon\'s      |
|                   |           | configuration script. See Adding   |
|                   |           | Configurable Settings for more     |
|                   |           | info.                              |
+-------------------+-----------+------------------------------------+
| updateURL         | no        | Link to a custom URL to check for  |
|                   |           | app updates, for addons that are   |
|                   |           | self-hosted. See: [Self-hosted     |
|                   |           | addon                              |
|                   |           | s](https://www.mediamonkey.com/wiki/Getting_Started_(Addons)#Self-hosted_addons) |
+-------------------+-----------+------------------------------------+
| installScript     | no        | The filename of your addon\'s      |
|                   |           | install script. The script will    |
|                   |           | run once when the addon is being   |
|                   |           | installed. `</br>`{=html}The       |
|                   |           | variable                           |
|                   |           | `window.__currentAddonPath` will   |
|                   |           | be set, pointing to the filesystem |
|                   |           | folder into which the addon has    |
|                   |           | been installed.                    |
+-------------------+-----------+------------------------------------+
| uninstallScript   | no        | The filename of your addon\'s      |
|                   |           | uninstall script. The script will  |
|                   |           | run once when the addon is being   |
|                   |           | uninstalled. `</br>`{=html}The     |
|                   |           | variable                           |
|                   |           | `window.__currentAddonPath` will   |
|                   |           | be set, pointing to the filesystem |
|                   |           | folder into which the addon has    |
|                   |           | been installed.                    |
+-------------------+-----------+------------------------------------+
| files             | no        | This only applies to plugins       |
|                   |           | (type: \"plugin\"). Contains an    |
|                   |           | array of objects, listing plugin   |
|                   |           | files to be added. \"src\" is the  |
|                   |           | source file path relative to the   |
|                   |           | root inside mmip and \"tgt\" is    |
|                   |           | the target file path relative to   |
|                   |           | the Plugins folder. It can only    |
|                   |           | write under the Plugins            |
|                   |           | folder.`</br>`{=html}Example:      |
|                   |           |                                    |
|                   |           | ``` js                             |
|                   |           |             "files": [{            |
|                   |           |                                    |
|                   |           |            "src": "pluginDLL.dll", |
|                   |           |                                    |
|                   |           |             "tgt": "pluginDLL.dll" |
|                   |           |             })                     |
|                   |           |                                    |
|                   |           | ```                                |
+-------------------+-----------+------------------------------------+
| showRestartPrompt | no        | Default is \"true\". Tells         |
|                   |           | MediaMonkey whether to prompt a    |
|                   |           | user for a restart. `</br>`{=html} |
|                   |           | Possible values: \"true\",         |
|                   |           | \"false\", \"install\", and        |
|                   |           | \"uninstall\". `</br>`{=html} If   |
|                   |           | \"true\", MM will prompt the user  |
|                   |           | for a restart on both install and  |
|                   |           | uninstall. `</br>`{=html} If       |
|                   |           | \"install\", MM will only prompt   |
|                   |           | on install. `</br>`{=html} If      |
|                   |           | \"uninstall\", MM will only prompt |
|                   |           | on uninstall. `</br>`{=html} If    |
|                   |           | \"false\", neither installing nor  |
|                   |           | uninstalling will prompt a         |
|                   |           | restart. `</br>`{=html}            |
|                   |           | `<u>`{=html}Must be a string if    |
|                   |           | provided. Boolean true/false is    |
|                   |           | not supported.`</u>`{=html}        |
+-------------------+-----------+------------------------------------+
```

\* May be required in the future.

### License

You can choose to include a license file in the root of your addon.
If present, when the addon is being installed. the license agreement 
will be shown to the user, and they will be required to accept the 
terms before installing.

Supported license file names:

- `license.txt`
- `license.md`
- `license<2-letter language code>.txt`, such as `licenseEN.txt`, `licenseFR.txt`, etc.

### Code

All the HTML/CSS/JS code that handles MM functionality is stored in a
tree structure. As a developer, you can add new files, replace existing,
or even extend functionality of the existing files. This is achieved by
replication of the folder structure in Addons. For example, if a file
controls\\checkbox.js is present in the Addon, it completely replaces
the default MM functionality of a checkbox. Similarly, an \_add suffix
in a filename extends functionality of an existing file. E.g.
dialogs\\dlgAbout_add.js can contain code that adds new controls to the
layout of the About dialog.

For information on how to load other files & scripts into your code,
please see the sections on `requirejs` and `localRequirejs` here:
[Important_Methods_and_Utilities\_(Addons)#requirejs](https://mediamonkey.com/wiki/Important_Methods_and_Utilities_(Addons)#requirejs)

### init.js

You can choose to include a script named init.js in the root of your
addon. If present, the script will run at startup.

### MediaMonkey folder structure

-   **Root** - Contains mainly mminit.js, which has the basic MM JS
    routines, several other utility .js files, maincontent.html which
    contains the basic definition of the main window. Also important is
    viewHandlers.js, which defines the tree structure of MM and
    behaviour of the views.
    -   **controls** - Contains all the controls used in MM UI. This
        starts with very basic controls, like button.js or dropdown.js,
        and continues with more complex things like listview.js and goes
        all the way to the complex UI elements, like equalizer.js,
        player.js or autoPlaylistEditor.js.
    -   **dialogs** - All the dialogs reside here, e.g.
        dlgConvertFormat.html + dlgConvertFormat.js
        -   **dlgOptions** - Panels for the Tools \> Options menu reside
            here.
    -   **helpers** - Contains miscellaneous helper scripts that do not
        fit into the other categories. For example: butt services, tray
        icon menus, docking, etc.
    -   **layouts** - Subfolders contain individual layouts, i.e.
        something that can replace/modify the files in the default
        folder structure in order to achieve completely different layout
        of MM (e.g. \"Touch mode\" layout). Unlike skins, layouts are
        supposed to mainly modify dimensions, positions and types of UI
        elements, not their color, etc. See
        [Layouts](https://www.mediamonkey.com/wiki/Customizing_MediaMonkey#Customizing_the_Layout) for more information.
    -   **scripts** - This contains all non-skin addons that are
        installed to MediaMonkey, including addons that are
        preinstalled. They are organized by id.
    -   **skin** - Contains basic skin definitions, mostly a set of LESS
        files (an extension to CSS). See <http://lesscss.org> for more
        information.
        -   **icon** - Contains all the icons used by MM. They are in
            SVG format in order to scale nicely to any display
            resolution. As anything else, they can be easily replaced by
            any Addon (skin or script).
    -   **skins** - Subfolders contain individual skins, i.e. something
        that can replace/modify the files in the default folder
        structure in order to achieve completely different looks of MM.
        Unlike layouts, this is supposed to mainly modify colors, fonts,
        icons, etc. See [Skinning](https://www.mediamonkey.com/wiki/Skinning_Guide) for more
        information.

Filetypes that can be overridden:

-   JS (e.g. controls/artistGrid.js
-   HTML (e.g. (root)/player.html)
-   LESS (e.g. skin/skin_complete.less)
-   SVG (e.g. skin/icon/about.svg)

Filetypes that can be added to:

-   JS (e.g. (root)/actions_add.js)
-   LESS (e.g. skin/skin_base_add.less)

Filetypes that can be added new:

-   JS (e.g. dialogs/dlgOptions/pnl_myAddon.js)
-   HTML (e.g. dialogs/dlgOptions/pnl_myAddon.html)
-   LESS (e.g. skin/skin_somethingnew.less)
-   SVG (e.g. skin/icon/newIcon.svg)
-   CSS (e.g. dialogs/dlgOptions/myExtraStylesheet.css) (Not
    recommended)

## Versioning

The versioning of addons must be in the format of three period-separated
numbers (for example 0.0.1, 1.2.34, etc.) We recommend using semantic
versioning (see <https://semver.org>).

MediaMonkey has a built-in updater for addons. When the user clicks
\"Find Updates\" in the addons screen, it will check online if there are
any updates for addons that are installed. If any are found, the user
clicks the download button that appears, then it will download and
install the updated addon.

## Submitting an addon

To submit an addon, you must first have an account on the MediaMonkey
forum and be signed in.

1.  Go to <https://www.mediamonkey.com/addons/> and click Submit Addon.
2.  Select the most appropriate sub-category under MediaMonkey 5 that
    describes your addon.
3.  Click Submit New Addon.
    1.  Name: Make sure it is the same as your addon\'s title, so that
        it does not confuse users after installing.
    2.  Description: This does not have to be the same as the
        description in info.json. You can be as descriptive as you like.
    3.  Support Link, Author Link, and License Type are optional.
    4.  Image is not required, but highly recommended. We recommend that
        it be a square image, and the same image as your addon\'s icon.
4.  Click next. On this page, you will add the first version of your
    addon.
    1.  Either upload your MMIP file or specify an external download
        link.
    2.  Compatibility: Specify the MediaMonkey versions on which you
        have confirmed your addon works.
    3.  What\'s New is optional, but you can specify updates here in
        future versions.
5.  Click Save. Review your changes, make sure everything is accurate,
    then click Finish.
6.  Your addon will appear in red until it is approved by a moderator.
    When approved, it will appear on the main addons page.

To add a new version of your addon, simply click Add New Version and
follow steps 4-5. Each additional version needs to be approved by a
moderator.

## Adding to scripts

To add code to the end of a certain script, create a JS file in its
appropriate location, with \_add at the end of its name.

For example, if you wish to make an addition to
controls/navigationBar.js, make controls/navigationBar_add.js inside
your MMIP. You can also entirely replace the file if you name it
controls/navigationBar.js inside your MMIP.

## Self-hosted addons

For addons hosted on external sites, please provide a field
**updateURL** in info.json to allow MediaMonkey to check for updates to
your addon. The server must reply with info on the most recent version
of the addon, in either XML or JSON format. More fields can be returned,
but will be ignored by current versions of MediaMonkey.

For a working example, see:
<https://www.happymonkeying.com/update.php?upd=300021> Please note that
since the release of that addon, the MinVersionMajor - MaxVersionBuild
fields have been replaced with MinAppVersion, as described below.

### XML

1.  The sequence of **VersionMajor**, **VersionMinor**, and
    **VersionRelease** form the standard version string; in the below
    example, it would be 3.0.6. **VersionBuild** also must be included
    but can be blank.
2.  **UpdateURL** is the link to download the addon as an MMIP.
3.  **MinAppVersion** refers to the minimum supported version of
    MediaMonkey. It is optional but highly recommended to include.

Example:

``` xml
<VersionMajor>3</VersionMajor>
<VersionMinor>0</VersionMinor>
<VersionRelease>6</VersionRelease>
<VersionBuild></VersionBuild>
<MinAppVersion>5.0.2</MinAppVersion>
<UpdateURL>http://myserver/myAddon.mmip</UpdateURL>
```

### JSON

In JSON, **version** is provided as a single string instead of the four
separate VersionX fields.

Example (equivalent to the XML above):

``` js
{
"version": "3.0.6",
"minAppVersion": "5.0.2",
"updateUrl":"http://myserver/myAddon.mmip"
}
```

# Important tips

-   **Minimize the amount of computation your addon does on startup.**
    Most scripts in MM run as soon as the window loads, so make sure
    your addon does not take a long time doing synchronous calculations
    that can cause the window to take longer to load. Ways to help avoid
    this:
    -   Use **window.whenReady()** when possible. Using
        window.whenReady() will cause your callback to only fire when
        all scripts are loaded, the whole DOM is processed by our
        parser, and all controls are initialized.
    -   Use asynchronous code when possible (with either callbacks,
        Promises, or async/await). If you perform heavy calculations
        that are synchronous, then it will halt the UI. See
        <https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await>
        for more information.
-   **Put your \_add scripts into an anonymous function.** To prevent
    potential issues of variables with the same name being used across
    different scripts, we recommend putting most/all of your logic into
    an anonymous function. You can do it with arrow notation or function
    notation.
    -   `(() => { /* Do stuff */ })();`
    -   `(function() { /* Do stuff */ })();`
-   **Enable Developer Mode.** Under Help \> About, you can enable
    Developer Mode. This will prevent crash logs from being
    automatically sent to MediaMonkey staff.
    -   Additionally, developer mode can be enabled in the code via
        `app.enabledDeveloperMode(true)` during testing. But **do not**
        keep it in your published extension.
-   **Use requestFrame and requestTimeout instead of
    requestAnimationFrame and setTimeout.** The custom functions
    automatically check whether the window/control still exists, and do
    not call the callback when the window/control have already been
    destroyed, to prevent crashes.
-   **Do not spam console.log** in your final addon that\'s distributed
    to users. While developing it, it is completely okay to use it as
    much as you want! However, the JavaScript console.log function is
    relatively computationally expensive, so if it spams logs, then it
    will degrade performance. If it just logs occasionally, for
    debugging purposes, it\'s okay. Just don\'t overdo it.
-   To avoid breaking for\...in loops, do not add functions to
    Array.prototype with the syntax
    `Array.prototype.func = function () {}`. Details here:
    <https://www.ventismedia.com/mantis/view.php?id=18145>

# Actions, Hotkeys & Menus

The MediaMonkey interface is controlled largely by actions, which are
defined inside actions.js. Most UI elements are tied to actions, and all
hotkeys are defined by actions.

**Note:** Defining custom actions must be done in actions_add.js.
Otherwise, MediaMonkey will not properly register the actions.

## Defining actions {#defining_actions}

Actions are defined in the global actions object. Each action contains
the following attributes:

```
+------------+--------------------+-----------+--------------------+
| Attribute  | Type               | Required? | Information        |
+============+====================+===========+====================+
| title      | function (string)  | **yes**   | Function that      |
|            |                    |           | returns the        |
|            |                    |           | (string) title of  |
|            |                    |           | the action.        |
+------------+--------------------+-----------+--------------------+
| execute    | function           | **yes**   | Function that runs |
|            |                    |           | when the action is |
|            |                    |           | executed.          |
+------------+--------------------+-----------+--------------------+
| category   | function (string)  | no        | Function that      |
|            |                    |           | returns the        |
|            |                    |           | (string) name of   |
|            |                    |           | the action\'s      |
|            |                    |           | category.          |
|            |                    |           | Categories are     |
|            |                    |           | defined in the     |
|            |                    |           | global             |
|            |                    |           | actionCategories   |
|            |                    |           | object. Default is |
|            |                    |           | general.           |
+------------+--------------------+-----------+--------------------+
| hotkeyAble | boolean            | no        | Determines whether |
|            |                    |           | the action can be  |
|            |                    |           | tied to a hotkey.  |
|            |                    |           | Default is false.  |
+------------+--------------------+-----------+--------------------+
| icon       | string             | no        | Icon that shows in |
|            |                    |           | menus that contain |
|            |                    |           | the action. The    |
|            |                    |           | icon ids are       |
|            |                    |           | located in         |
|            |                    |           | sk                 |
|            |                    |           | in/(iconname).svg. |
+------------+--------------------+-----------+--------------------+
| visible    | function (boolean) | no        | Determines whether |
|            |                    |           | the action will    |
|            |                    |           | show up in menus.  |
|            |                    |           | This can be useful |
|            |                    |           | for integrating    |
|            |                    |           | party mode, for    |
|            |                    |           | example, by        |
|            |                    |           | disabling your     |
|            |                    |           | action when party  |
|            |                    |           | mode is enabled    |
|            |                    |           | with               |
|            |                    |           |                    |
|            |                    |           | `           ``vi   |
|            |                    |           | sible: window.uito |
|            |                    |           | ols.getCanEdit``.` |
+------------+--------------------+-----------+--------------------+
```

Additionally, actions can contain any other custom attributes and
methods.

Defining your own custom action in actions_add.js:

``` js
actions.myCustomAction = {
    title: 'My Custom Action',
    hotkeyAble: true,
    execute: function () {
        messageDlg('This action was created by hotkeyAction script.', 'information', ['btnOK'], {
            defaultButton: 'btnOK'
        }, undefined);
    }
}
```

## Assigning hotkeys to actions

Assigning hotkeys is very simple. Hotkeys are handled by the global
hotkeys object, and you can register a hotkey with the hotkeys.addHotkey
method.

Usage:

    hotkeys.addHotkey(hotkey, action, global);
	
Attribute | Type | Required? | Information
---|---|---|---
`hotkey` | `string` | **yes** | The hotkey to assign. See Toold \> Options \> Hotkeys for the right syntax.
`action` | `string` | **yes** | The action (in window.actions) to execute. Case sensitive.
`global` | `boolean` | **no** | Determines whether the hotkey is global (accessible outside the MM window). Default is false.

Adding a hotkey to your custom action:

``` js
hotkeys.addHotkey('Ctrl+Shift+Q', 'myCustomAction');
```

The addHotkey method automatically handles duplicates and deletions. So
if a user deletes the hotkey, you don\'t have to worry about it showing
up again every time the window reloads; and they can manually re-add it.

To see the syntax that MediaMonkey uses for hotkeys, go to the
Tools\>Options\>Hotkeys window and type in your desired hotkey.

## Adding actions to menus

MediaMonkey uses a structure for menus that allows infinitely nested
sub-menus. The data structure of a menu item is as follows:

``` js
menuItem = {
    action: {
        title: String,      // Required
        execute: Function,  // Usually required
        icon: String,
        visible: Boolean,
        disabled: Boolean
    },
    order: Number,          // Required
    grouporder: Number,     // Required
    submenu: Array
}
```

The `submenu` field, which is optional, contains an array of as many
other menu items as desired. The `grouporder` field determines which
group a menu item will belong to, and groups will be automatically
sorted by the `order` field. Menu items defined in actions.js are
intentionally given order and grouporder like 10, 20, 30, etc. to allow
addons to insert menu items in between them as desired.

Note: These fields can *either* be the datatype as described above *or*
a function which returns the requested data type. At runtime, the global
method `resolveToValue` is called, which either returns the primitive
type or calls the provided function. If you analyze the actions in
actions.js, you\'ll see bits like `visible: window.uitools.getCanEdit`.
This is an example of a function which resolves to a boolean.

There are two menu groups that you will most likely want to add items
to: The main menu bar, and tracklist menus.

### Main menu bar

The File, Edit, View, etc. menus are defined in `window._menuItems`,
from actions.js. See actions.js or look in the devtools console to see
all the possible submenus to which to add your action. **You can only
add to these menus inside actions_add.js.**

For example, if you wish to add an action to the \"Tools \> Edit tags\"
submenu, that is under `window._menuItems.editTags`:

``` js
window._menuItems.editTags.submenu.push({
    action: actions.myNewAction,
    order: 10,
    grouporder: 10
});
```

### Tracklist menus

Tracklist menus, which may also be called media menus, are the ones that
contain *Play now*, *Play next*, *Properties*, etc. These are defined in
`window.menus.tracklistMenuItems`, from controls/trackListView.js. **You
should only add to these menus inside controls/trackListView_add.js.**

For example, if you wish to add an action below Cut, Copy, and Paste,
but above Rename:

-   First, look in the definition of menus.tracklistMenuItems that
    Cut/Copy/Paste/Rename are in group 40, Paste\'s order is 30, and
    Rename\'s order is 35.
-   This item must go in the same group and have an order between 30 and
    35.

``` js
window.menus.tracklistMenuItems.push({
    action: actions.myNewAction,
    order: 31,
    grouporder: 40
});
```

## Categories

*Coming soon*

# Storing Data

## JSON

When you wish to save data such as user preferences, the most effective
method is to save values in persistent.json. The way you do this is
through the app.setValue and app.getValue methods. Both methods require
two parameters.

If retrieving a value that is primitive, set the second parameter as
undefined.

``` javascript
app.setValue('myExtension_foo', 'bar');
    
var foo = app.getValue('myExtension_foo', undefined);
```

When retrieving a value that is an object, you must provide the second
parameter as an object. The function will take that object and populate
each value if it exists, so you can easily manage default settings this
way.

``` javascript
// Saving settings
app.setValue('myExtension_settings', {
    option1: 0,
    option2: 'electric boogaloo'
});
// Getting settings with hardcoded defaults
var settings = app.getValue('myExtension_settings', {
    option1: 0,
    option2: 'default'
})
// Passing an empty object works too
var settings = app.getValue('myExtension_settings', {});
```

This data is automatically saved in persistent.json, which is saved in
the user\'s AppData folder or the Portable subfolder; for non-portable
and portable installations, respectively. Persistent.json is only
deleted if the user manually deletes it or removes a portable
installation. **Important:** Make sure the keys that you use are unique.
Include the addon ID in the key, as demonstrated above, to ensure this.

## Database

If you need to manage more data, you can use the database. In MM5, you
can access the database through the app.db object. For more information,
see: <https://www.mediamonkey.com/webhelp/MM5Preview/classes/DB.html>.

To execute queries that do not need return values, use
app.db.executeQueryAsync:

``` javascript
app.db.executeQueryAsync('CREATE TABLE IF NOT EXISTS myPlugin (_id INTEGER PRIMARY KEY, value TEXT UNIQUE NOT NULL)')
.then(() => {
    app.db.executeQueryAsync('INSERT INTO myPlugin [. . .]');
})
.catch(err => {
    console.error(err)
});

To execute queries that need return values, use app.db.getQueryResultAsync:
app.db.getQueryResultAsync('SELECT * FROM Albums')
.then(result => {
    // do stuff
})
.catch(err => console.error(err));
```

This method returns a QueryResults object, which is a linked list. See
<https://www.mediamonkey.com/webhelp/MM5Preview/classes/QueryResults.html>.

## Adding Configurable Settings to your Addon

There are two ways to add configurable options to an addon: via the
\"config\" option in info.json, or modifying the options dialog.

### Addon Config

The recommended way of adding configurable settings to an addon, if the
settings are not directly related to an existing options panel, is to
use the built-in addon configuration options. To do this, you must
specify \"config\" in info.json:

    "config": "config.js"

Inside your configuration js file, you must define a window.configInfo
object, with two functions: load and save.

Load is executed during page load, and save is executed after \"OK\" is
pressed. Both functions are passed two parameters: pnl and item.

-   \"pnl\" (pnlDiv) is the HTML node of the panel
-   \"item\" (addon) is an object that contains information about the
    addon, such as title, ext_id, description, version, installType,
    author, path, etc.

You can opt to add a config HTML as well, by giving it the same base
name as your config JS. For example, if it is named config.js, create
config.html; if it is named MediaMonkeyRocks.js, create
MediaMonkeyRocks.html.

When a configuration script is provided for an addon, the panel will
open once the addon is installed. Additionally, a button will appear in
its listing to open the configuration panel.

Example usage:

config.html

``` html
<div class="uiRows">
    <div>
        <div data-id="chbOption1" data-control-class="Checkbox" data-tip="Option 1 tooltip">Option 1</div>
    </div>
    <div>
        <div data-id="chbOption2" data-control-class="Checkbox" data-tip="Option 2 tooltip">Option 1</div>
    </div>
</div>
```

config.js

``` js
window.configInfo = {
    load: function (pnlDiv, addon) {
        // Load config with defaults
        this.config = app.getValue('myAddon_config', {
            option1: true,
            option2: false,
        });
        // Set checkboxes to the configuration settings
        var UI = getAllUIElements(pnlDiv);
        UI.chbOption1.controlClass.checked = this.config.option1;
        UI.chbOption2.controlClass.checked = this.config.option2;
    },
    save: function (pnlDiv, addon) {
        // Save settings according to the checkbox changes
        var UI = getAllUIElements(pnlDiv);
        this.config.option1 = UI.chbOption1.controlClass.checked;
        this.config.option2 = UI.chbOption2.controlClass.checked;
        app.setValue('myAddon_config', this.config);
    }
}
```

### Options Dialog

When modifying the options dialog, you can either add to / modify an
existing panel or create your own panel.

#### Adding to an existing panel

Adding to an existing panel can be done with \_add JS files. For more
context, take a look at dialogs/dlgOptions.js.

For example, if you wish to add to the General Options panel:

1.  Create dialogs/dlgOptions/pnl_General_add.js
2.  Override the optionPanels.pnl_General.load and
    optionPanels.pnl_General.save functions to add your own code
3.  Use the divFromSimpleMenu function to automatically create styled
    checkboxes/radio buttons
4.  Use app.getValue and app.setValue to retrieve and save the user
    settings

``` javascript
(() => {
    var options = [
        {
            title: 'Option 1', // The label that appears on the checkbox/radio button
            radiogroup: 'myAddon_RadioOptions', // Self-explanatory
            execute: function() {state.RadioOptions = 'option1'} // This function runs whenever the element is clicked
        },
        {
            title: 'Option 2',
            radiogroup: 'myAddon_RadioOptions',
            execute: function() {state.RadioOptions = 'option2'}
        },
        {
            title: 'My Checkbox',
            checkable: true, // Turns it into a checkbox
            execute: function() {state.Checkbox = this.checked;}
        },
    ]
    var state;
    
    optionPanels.pnl_General.override({
        load: function($super, sett, pnlDiv) {
            $super(sett, pnlDiv);
            console.log('yoyoyoyoyo')
            
            state = app.getValue('myAddon_settings', {
                RadioOptions: 'option1',
                Checkbox: false
            });
            // Update checkbox/radiobutton state from settings
            if (state.RadioOptions == 'option1') {options[0].checked = true; options[1].checked = false;} 
            else {options[0].checked = false; options[1].checked = true}
            if (state.Checkbox == true) options[2].checked = true;
            // Create an HTML menu from the options
            divFromSimpleMenu(pnlDiv, options);
        },
        save: function($super, sett, pnlDiv) {
            $super(sett, pnlDiv);
            // Save settings
            app.setValue('myAddon_settings', state);
        }
    });
})();
```

#### Creating a new panel

You can define your new panel inside dialogs/dlgOptions, and add it
inside dialogs/dlgOptions_add.js.

*Coming soon*

# Plugins

While most functionality can be reached in MediaMonkey 5 via addons
using JS/HTML, it still supports the majority of the Winamp 2.0 API.
Winamp plugin support for MediaMonkey 5 is the same as in MediaMonkey 4.
See [Winamp Plug-ins (MM4)](https://www.mediamonkey.com/wiki/Winamp_Plug-ins_(MM4)) for more
details.

## Packaging a Plugin

To create an MMIP installer for a plugin, you need to include the
information about your plugin\'s file\[s\] into info.json:

``` json
"type": "plugin",
"files": [{
    "src": "pluginDLL.dll",
    "tgt": "pluginDLL.dll"
}]
```

It can contain more files. \"src\" is the source file path relative to
the root inside mmip, and \"tgt\" is target file relative to the Plugins
folder inside the MediaMonkey installation. It can write only under the
Plugins folder.

If needed, you can also include an installScript and uninstallScript:

``` json
"installScript": "install.js",
"uninstallScript": "uninstall.js"
```

The install script will run during installation and uninstall script
will run after uninstallation.

Both will run inside the main window, allowing full access to the UI.
Additionally, the variable `window.__currentAddonPath` will be set,
pointing to the filesystem folder into which the addon has been
installed.

# Accessing the main window object from other windows

Sometimes, you may need to run functions or access properties from the
main window in the context of other windows. For example, performing
live updates in an options panel. To do this, use the
app.dialogs.getMainWindow() method.

If you have a property \"x\" in the main window, this is how to access
it from another window:

``` js
app.dialogs.getMainWindow().getValue('x')
```

If you assign a property or method to \"app\", you will need to do this
to get the version of it that is attached to the main window.

``` js
app.dialogs.getMainWindow().getValue('app').myObject.myMethod();
```

# UI Elements & Controls

## Icons

Instead of bitmaps, MediaMonkey uses
[SVGs](https://en.wikipedia.org/wiki/Scalable_Vector_Graphics) for its
icons. They are stored in the `skin/icon` folder. This is because SVGs
can be scaled to any size without appearing pixelated. See [Skinning
Guide/Creating Icons](https://www.mediamonkey.com/wiki/Skinning_Guide#Creating_Icons) for an
introduction on how to create custom icons.

There are three ways to load icons: The `data-icon` HTML attribute;
`loadIconFast()`; and `loadIcon()`.

### data-icon

Whenever HTML is loaded and/or classes are initialized, any and all
elements with the attribute \"data-icon\" will automatically load the
SVG files associated with the icon name provided. For details on how it
works, check window.initializeControls in mminit.js. See this example:

``` html
<div data-control-class="toolbutton" data-icon="music"></div>
```

This will create a ToolButton control with the icon from music.svg.
Using the ToolButton control class is not required, but if you do not
add any CSS to limit the size of the icon, it will appear very large.

### loadIconFast

If you wish to load an icon programmatically, use `loadIconFast()`. For
more details, see
[loadIconFast](https://www.mediamonkey.com/docs/api/classes/Window.html#method_loadIconFast).

### loadIcon

Only use `loadIcon()` if you need to access the raw SVG code before
adding it to the DOM. For more details, see
[loadIcon](https://www.mediamonkey.com/docs/api/classes/Window.html#method_loadIcon).

*More coming soon*
