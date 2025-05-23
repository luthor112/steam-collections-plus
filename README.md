# Collections+

A Millennium plugin that adds extra functionality to collections on Steam.

## Features
- Replace or reset Collection image
- Add/remove applications to/from collections in bulk

## Prerequisites
- [Millennium](https://steambrew.app/)

## Bulk add/remove filter language
- Multiple predicates can be provided, delimited by `;`
- Each predicate is made up of two or three parts: `<PROPERTY> <OPERATOR> <VALUE>`
- Valid predicates:

|PROPERTY                |VALID OPERATORS    |VALUE TYPE|DESCRIPTION                                                    |
|------------------------|-------------------|----------|---------------------------------------------------------------|
|collection              |= !=               |string    |application is (=) or is not (!=) part of the named collection |
|category                |= !=               |number    |application is (=) or is not (!=) part of the given category   |
|tag                     |= !=               |number    |application has (=) or does not have (!=) the given tag        |
|\<ANY BOOLEAN PROPERTY\>|true false         |          |property is true or false                                      |
|\<ANY STRING PROPERTY\> |= != begins        |string    |property equals, does not equal, or begins with the given value|
|\<ANY NUMBER PROPERTY\> |= != \< \> \<= \>= |number    |yes                                                            |

- Examples:
    - Applications where the name begins with "W": `display_name begins W`
    - Applications that are part of the "UTIL" Collection: `collection = UTIL`
    - Applications where the name begins with "W", that are part of the "UTIL" collection and have been played for more than 10 minutes: `display_name begins W;collection = UTIL;minutes_playtime_forever > 10`

## Known issues
- Collection images are tinted
    - If you know how to remove the tint, feel free to open a PR
- Text-based filtering instead of a full-fledged UI
    - Yeah...