# Roadmap

The build status, immediate-term plans, and future goals of this repository.

> ###### Feature Requests
>
> We welcome feature requests as edits to the "Backlog" section below.
>
> Before editing this file, please check out [How To Contribute to ROADMAP.md](https://gist.github.com/mikermcneil/bdad2108f3d9a9a5c5ed)- it's a quick read :)


## Current Build Status

The current Travis test output for this repository.

| Release                                                                                                                 | Install Command                                                | Build Status
|------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -----------------
| [![NPM version](https://badge.fury.io/js/skipper-s3.png)](https://github.com/balderdashy/skipper-s3/tree/stable) _(stable)_  | `npm install skipper-s3`                                          | [![Build Status](https://travis-ci.org/balderdashy/skipper-s3.png?branch=stable)](https://travis-ci.org/balderdashy/skipper-s3) |
| [edge](https://github.com/balderdashy/skipper-s3/tree/master)                                                              | `npm install skipper-s3@git://github.com/balderdashy/skipper-s3.git` | [![Build Status](https://travis-ci.org/balderdashy/skipper-s3.png?branch=master)](https://travis-ci.org/balderdashy/skipper-s3) |


## Roadmap

Our short-to-medium-term roadmap items, in order of descending priority:

_(feel free to suggest things)_

 Feature                                                  | Owner                                                                            | Details
 :------------------------------------------------------- | :------------------------------------------------------------------------------- | :------
 explore alternatives to knox                | [@mikermcneil](https://github.com/mikermcneil)                                   | explore a migration from knox-mpu+knox to one of the other S3 node modules which is more actively maintained.


#### Backlog

The backlog consists of features which are not currently in the immediate-term roadmap above, but are useful.  We would exuberantly accept a pull request implementing any of the items below, so long as it was accompanied with reasonable tests that prove it, and it doesn't break other core functionality.

 Feature                                         | Owner                                                                            | Details
 :---------------------------------------------- | :------------------------------------------------------------------------------- | :------
 support customizable ACL parameters in options  | [@abrantes01](https://github.com/abrantes01) | ability to attach ACL parameters in order to allow public access to files (See example [here](https://github.com/balderdashy/skipper-s3/issues/1)
support path prefix parameter in options  | [@heijmerikx](https://github.com/heijmerikx) | ability to specify a (path)prefix to the uploaded file
