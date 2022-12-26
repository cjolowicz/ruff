use std::borrow::Cow;

use rustc_hash::FxHashMap;
use rustpython_ast::Location;

use crate::ast;

#[derive(Hash, Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Default)]
pub struct LocationHash {
    row: usize,
    column: usize,
}

impl LocationHash {
    pub fn new(location: Location) -> Self {
        Self { row: location.row(), column: location.column() }
    }
}

impl PartialEq<Location> for &LocationHash {
    fn eq(&self, other: &Location) -> bool {
        self.row == other.row() && self.column == other.column()
    }
}

#[derive(Hash, Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Default)]
pub struct LocationWrapper {
    location: Vec<LocationHash>
}

impl LocationWrapper {
    pub fn new(locations: Vec<Location>) -> Self {
        let mut new_locations: Vec<LocationHash> = Vec::new();
        for location in locations {
            new_locations.push(LocationHash::new(location));
        }
        Self { location: new_locations }
    }

    pub fn add_locations(&mut self, wrapper: LocationWrapper) {
        self.location.extend(wrapper.location);
    }
}

#[derive(Debug, Hash, Ord, PartialOrd, Eq, PartialEq)]
pub struct ImportFromData<'a> {
    pub module: Option<&'a String>,
    pub level: Option<&'a usize>,
}

#[derive(Debug, Hash, Ord, PartialOrd, Eq, PartialEq)]
pub struct AliasData<'a> {
    pub name: &'a str,
    pub asname: Option<&'a String>,
}

#[derive(Debug, Default)]
pub struct CommentSet<'a> {
    pub atop: Vec<Cow<'a, str>>,
    pub inline: Vec<Cow<'a, str>>,
}

pub trait Importable {
    fn module_name(&self) -> String;
    fn module_base(&self) -> String;
}

impl Importable for AliasData<'_> {
    fn module_name(&self) -> String {
        self.name.to_string()
    }

    fn module_base(&self) -> String {
        self.module_name().split('.').next().unwrap().to_string()
    }
}

impl Importable for ImportFromData<'_> {
    fn module_name(&self) -> String {
        ast::helpers::format_import_from(self.level, self.module)
    }

    fn module_base(&self) -> String {
        self.module_name().split('.').next().unwrap().to_string()
    }
}

#[derive(Debug, Default)]
pub struct ImportBlock<'a> {
    // Set of (name, asname), used to track regular imports.
    // Ex) `import module`
    pub import: FxHashMap<AliasData<'a>, CommentSet<'a>>,
    // Map from (module, level) to `AliasData`, used to track 'from' imports.
    // Ex) `from module import member`
    pub import_from:
        FxHashMap<ImportFromData<'a>, (CommentSet<'a>, FxHashMap<AliasData<'a>, CommentSet<'a>>, LocationWrapper)>,
    // Set of (module, level, name, asname), used to track re-exported 'from' imports.
    // Ex) `from module import member as member`
    pub import_from_as: FxHashMap<(ImportFromData<'a>, AliasData<'a>), CommentSet<'a>>,
    // Map from (module, level) to `AliasData`, used to track star imports.
    // Ex) `from module import *`
    pub import_from_star: FxHashMap<ImportFromData<'a>, CommentSet<'a>>,
}

type AliasDataWithComments<'a> = (AliasData<'a>, CommentSet<'a>);

#[derive(Debug, Default)]
pub struct OrderedImportBlock<'a> {
    pub import: Vec<AliasDataWithComments<'a>>,
    pub import_from: Vec<(
        ImportFromData<'a>,
        CommentSet<'a>,
        LocationWrapper,
        Vec<AliasDataWithComments<'a>>,
    )>,
}
