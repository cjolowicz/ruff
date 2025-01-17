//! Detect code style from Python source code.

use std::ops::Deref;

use once_cell::unsync::OnceCell;
use rustpython_ast::Location;
use rustpython_parser::lexer;
use rustpython_parser::lexer::Tok;

use crate::ast::types::Range;
use crate::pydocstyle::helpers::leading_quote;
use crate::source_code_locator::SourceCodeLocator;
use crate::vendor;

pub struct SourceCodeStyleDetector<'a> {
    contents: &'a str,
    locator: &'a SourceCodeLocator<'a>,
    indentation: OnceCell<Indentation>,
    quote: OnceCell<Quote>,
}

impl<'a> SourceCodeStyleDetector<'a> {
    pub fn indentation(&'a self) -> &'a Indentation {
        self.indentation
            .get_or_init(|| detect_indentation(self.contents, self.locator).unwrap_or_default())
    }

    pub fn quote(&'a self) -> &'a Quote {
        self.quote
            .get_or_init(|| detect_quote(self.contents, self.locator).unwrap_or_default())
    }

    pub fn from_contents(contents: &'a str, locator: &'a SourceCodeLocator<'a>) -> Self {
        Self {
            contents,
            locator,
            indentation: OnceCell::default(),
            quote: OnceCell::default(),
        }
    }
}

/// The quotation style used in Python source code.
#[derive(Debug, PartialEq, Eq)]
pub enum Quote {
    Single,
    Double,
}

impl Default for Quote {
    fn default() -> Self {
        Quote::Double
    }
}

impl From<&Quote> for vendor::str::Quote {
    fn from(val: &Quote) -> Self {
        match val {
            Quote::Single => vendor::str::Quote::Single,
            Quote::Double => vendor::str::Quote::Double,
        }
    }
}

/// The indentation style used in Python source code.
#[derive(Debug, PartialEq, Eq)]
pub struct Indentation(String);

impl Indentation {
    pub fn new(indentation: String) -> Self {
        Self(indentation)
    }
}

impl Default for Indentation {
    fn default() -> Self {
        Indentation("    ".to_string())
    }
}

impl Deref for Indentation {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Detect the indentation style of the given tokens.
fn detect_indentation(contents: &str, locator: &SourceCodeLocator) -> Option<Indentation> {
    for (_start, tok, end) in lexer::make_tokenizer(contents).flatten() {
        if let Tok::Indent { .. } = tok {
            let start = Location::new(end.row(), 0);
            let whitespace = locator.slice_source_code_range(&Range {
                location: start,
                end_location: end,
            });
            return Some(Indentation(whitespace.to_string()));
        }
    }
    None
}

/// Detect the quotation style of the given tokens.
fn detect_quote(contents: &str, locator: &SourceCodeLocator) -> Option<Quote> {
    for (start, tok, end) in lexer::make_tokenizer(contents).flatten() {
        if let Tok::String { .. } = tok {
            let content = locator.slice_source_code_range(&Range {
                location: start,
                end_location: end,
            });
            if let Some(pattern) = leading_quote(&content) {
                if pattern.contains('\'') {
                    return Some(Quote::Single);
                } else if pattern.contains('"') {
                    return Some(Quote::Double);
                }
                unreachable!("Expected string to start with a valid quote prefix")
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use crate::source_code_style::{detect_indentation, detect_quote, Indentation, Quote};
    use crate::SourceCodeLocator;

    #[test]
    fn indentation() {
        let contents = r#"x = 1"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(detect_indentation(contents, &locator), None);

        let contents = r#"
if True:
  pass
"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(
            detect_indentation(contents, &locator),
            Some(Indentation("  ".to_string()))
        );

        let contents = r#"
if True:
    pass
"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(
            detect_indentation(contents, &locator),
            Some(Indentation("    ".to_string()))
        );

        let contents = r#"
if True:
	pass
"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(
            detect_indentation(contents, &locator),
            Some(Indentation("\t".to_string()))
        );

        // TODO(charlie): Should non-significant whitespace be detected?
        let contents = r#"
x = (
  1,
  2,
  3,
)
"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(detect_indentation(contents, &locator), None);
    }

    #[test]
    fn quote() {
        let contents = r#"x = 1"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(detect_quote(contents, &locator), None);

        let contents = r#"x = '1'"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(detect_quote(contents, &locator), Some(Quote::Single));

        let contents = r#"x = "1""#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(detect_quote(contents, &locator), Some(Quote::Double));

        let contents = r#"
def f():
    """Docstring."""
    pass
"#;
        let locator = SourceCodeLocator::new(contents);
        assert_eq!(detect_quote(contents, &locator), Some(Quote::Double));
    }
}
