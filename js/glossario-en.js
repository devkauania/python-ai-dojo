// glossario-en.js — English glossary for the hover tooltips.
//
// Same format and SAME KEYS as js/glossario.js (the Portuguese one): a flat
// object { "token": "definition" }. The key is the EXACT token as it appears in
// `code` spans of the exercise text; the value is 1-2 sentences: what it is +
// what it is for, always with a memorable mental image. No double quotes, no
// markdown, no emoji. Aliases repeat the same text (direct lookup, no refs).
// Keys that only make sense in Portuguese content ("cosseno", "temperatura")
// are kept so both languages share one key set; English-only aliases
// ("cosine") are appended at the end.

export const GLOSSARIO_EN = {

  // ---------------------------------------------------------------
  // Basics: flow, conditions and keywords
  // ---------------------------------------------------------------
  "def": "Defines a function: gives a name to a recipe of steps you can run as many times as you want just by calling it. Ingredients come in as parameters; the dish goes out through return.",
  "return": "Ends the function and hands a value back to the caller, like a cashier giving you change and closing the sale. Without return, the function gives back None.",
  "print": "Shows a value on screen: the program's loudspeaker. Great for checking what is going on, but it returns nothing — return is what hands values back.",
  "input": "In Python, pauses and waits for the user to type, ALWAYS returning text (str). On the web, it is the form field you type into — and the event that fires on every keystroke.",
  "if": "Creates a fork in the road: the block only runs if the condition is true, like a doorman who only lets in people who meet the rule.",
  "elif": "A second doorman in line: only asked if the previous if said no. Chains several conditions without nesting block inside block.",
  "else": "Plan B of the fork: runs when no earlier condition passed — the door that takes everyone who is left.",
  "for": "A loop that walks through a collection item by item, like a mail carrier visiting every house on the street once and doing the same job at each stop.",
  "while": "Repeats while the condition is true, like a tap left open until the bucket is full. If the condition never turns false, you get an infinite loop.",
  "break": "The loop's emergency button: stops the repetition right now and jumps past it, even if there were items left.",
  "continue": "Skips only the current round of the loop and goes straight to the next one — the inspector tosses the faulty part and moves on down the belt.",
  "pass": "Does nothing on purpose: fills a block the syntax requires, like an empty seat with a reserved sign.",
  "import": "Brings a ready-made module into your code, like grabbing a toolbox from the shed: you don't forge the hammer, you just pick it up and use it.",
  "from": "Imports only the piece you need from a module: instead of hauling the whole box, you take out just the tool you will use.",
  "as": "Gives a nickname to what was imported, like calling numpy np: a short name everybody recognizes.",
  "in": "A presence detector: asks whether something is inside a collection (3 in my_list) — and, in a for, it is what hands you one item at a time.",
  "and": "True only if BOTH sides are true: a door with two locks that needs both keys.",
  "or": "True if AT LEAST ONE side is: two doorbells on the same door — either one rings somebody.",
  "not": "Flips the truth value: true becomes false and vice versa, like a switch that always toggles the light.",
  "is": "Asks whether two names point to the SAME object in memory, not just equal values. Classic use: x is None.",
  "None": "The value of absence: the drawer exists, but it is empty. Functions without return give back None, and the right check is x is None.",
  "True": "Python's logical yes, with a capital T: the value that lets if and while move forward.",
  "False": "Python's logical no, with a capital F. Watch out: 0, empty text and an empty list also count as false in a condition.",

  // ---------------------------------------------------------------
  // Functions, classes and scope
  // ---------------------------------------------------------------
  "yield": "Pauses the function and HANDS OUT a value without ending it; on the next call it picks up right there. Turns the function into a conveyor belt that produces one item at a time, without loading everything into memory.",
  "lambda": "A one-line anonymous function: a throwaway recipe written right where it is used. Perfect as a sort key: sorted(items, key=lambda x: x[1]).",
  "class": "A mold for making objects: defines the data and the actions of each copy, like a house blueprint that becomes many houses.",
  "self": "Inside the class, it is the object talking about itself: self.name is the badge THIS object wears, different from everyone else's badge.",
  "__init__": "The constructor: runs by itself when the object is created and fills in the starting data, like the sign-up form at the club entrance.",
  "dataclass": "A decorator that writes __init__, __repr__ and __eq__ for you in classes that hold data: you declare the fields, Python does the rest.",
  "@dataclass": "A decorator that writes __init__, __repr__ and __eq__ for you in classes that hold data: you declare the fields, Python does the rest.",
  "decorator": "A function that wraps another one to add behavior (timing, retrying, validating) without touching the original code — a coat over the clothes.",
  "nonlocal": "In a nested function, says the variable belongs to the outer function: without it, assigning would create a new variable instead of updating the one above.",

  // ---------------------------------------------------------------
  // Types and collections
  // ---------------------------------------------------------------
  "int": "A whole number, no decimal point: counts things that don't split — tokens, attempts, pages. int(text) converts, or raises ValueError if the text is not a number.",
  "int()": "A whole number, no decimal point: counts things that don't split — tokens, attempts, pages. int(text) converts, or raises ValueError if the text is not a number.",
  "float": "A number with decimals: price, temperature, latency. float(text) converts — but remember 0.1 + 0.2 is not exactly 0.3.",
  "str": "Text: an immutable sequence of characters. Everything the user types arrives as str; str(x) turns any value into text.",
  "bool": "A logical type with two values: True and False. It is the answer to every comparison and the fuel of if and while.",
  "list": "An ordered, mutable collection, like a train of cars: each item has a position, and you can hook on, remove and reorder. Written with square brackets: [1, 2, 3].",
  "dict": "A collection of key -> value pairs, like a cabinet of labeled drawers: you ask by label (key) and get the contents (value) at once, without opening drawer after drawer.",
  "set": "A collection with no order and no repeats, like a guest list: each name gets in once. Ideal for removing duplicates and checking membership fast.",
  "tuple": "An ordered, IMMUTABLE collection, like a sealed package: once created, nobody swaps the items. Great for fixed pairs like (text, score).",
  "len": "The universal tape measure: tells how many characters a text has, or how many items a list or dict has.",
  "range": "Makes numbers on demand: range(5) yields 0, 1, 2, 3, 4, one at a time, without building the whole list. The classic partner of for.",
  "enumerate": "Walks the collection handing you (index, item) each round: a numbered badge for every element, without counting on the side.",
  "zip": "Zips two lists together: first with first, second with second, making pairs. For data that travels in parallel columns.",
  "sorted": "Returns a NEW sorted list, leaving the original alone. With key= you choose how the line is ordered: by price, by size, by anything you like.",
  "sum": "Adds up every number in a collection in one go: sum([1, 2, 3]) is 6. Python's end-of-day cash count.",
  "any": "Asks whether AT LEAST ONE item is true — and stops at the first yes, like an inspector who ends the check at the first violation found.",
  "all": "Asks whether ALL items are true — and stops at the first no, like a pre-flight checklist: one failed item cancels the flight.",
  "append": "Hooks an item onto the END of the list: my_list.append(item) changes the list itself and returns nothing — don't store the result.",
  "pop": "Removes AND returns an item: you unhook the car and keep it in your hand. On lists, the last one by default; on dicts, d.pop(key) takes the whole drawer.",
  "get": "The polite way to read a dict: d.get(key, default) returns the value if the key exists, or the default if it doesn't — no KeyError explosion.",
  ".get": "The polite way to read a dict: d.get(key, default) returns the value if the key exists, or the default if it doesn't — no KeyError explosion.",
  "items": "Opens the cabinet showing label and contents together: for key, value in d.items() walks the dict in pairs.",
  "keys": "Lists only the dict's labels (the keys): useful to know what is in the cabinet before opening drawers.",
  "values": "Lists only the dict's contents (the values): useful to add up or check everything stored, as in sum(d.values()).",

  // ---------------------------------------------------------------
  // String methods
  // ---------------------------------------------------------------
  "split": "Cuts the text into a list of pieces: with no argument it splits on spaces and the sentence becomes a train of words; with an argument it cuts wherever you say.",
  ".split()": "Cuts the text into a list of pieces: with no argument it splits on spaces and the sentence becomes a train of words; with an argument it cuts wherever you say.",
  "join": "Glues a list of texts into one, using the text BEFORE the dot as glue: separator.join(my_list). The way back from split.",
  ".join": "Glues a list of texts into one, using the text BEFORE the dot as glue: separator.join(my_list). The way back from split.",
  "strip": "Trims spaces and line breaks from both ends without touching the middle — peels the skin, keeps the filling. Essential before comparing what the user typed.",
  ".strip()": "Trims spaces and line breaks from both ends without touching the middle — peels the skin, keeps the filling. Essential before comparing what the user typed.",
  "replace": "Swaps every occurrence of one piece of text for another and returns a NEW text: the original stays intact, because strings are immutable.",
  ".lower()": "Returns the whole text in lowercase, leveling the field so comparisons have no gotchas: Cat and cat become equal.",
  "lower()": "Returns the whole text in lowercase, leveling the field so comparisons have no gotchas: Cat and cat become equal.",
  "casefold": "A supercharged lower for comparisons: it even normalizes special characters from other languages. The right default for matching text typed by humans.",
  "casefold()": "A supercharged lower for comparisons: it even normalizes special characters from other languages. The right default for matching text typed by humans.",
  ".casefold()": "A supercharged lower for comparisons: it even normalizes special characters from other languages. The right default for matching text typed by humans.",
  "f-string": "Text with blanks filled in on the spot: f'Hello, {name}' drops the variable's value straight into the sentence. Goodbye, gluing strings with +.",

  // ---------------------------------------------------------------
  // Errors and exceptions
  // ---------------------------------------------------------------
  "try": "Opens a guarded section: if something blows up in here, Python doesn't crash the program — it jumps straight to except to handle the problem.",
  "try:": "Opens a guarded section: if something blows up in here, Python doesn't crash the program — it jumps straight to except to handle the problem.",
  "except": "The safety net of try: catches the named error and decides what happens next — log it, retry, return a default. Catch specific errors, not everything.",
  "finally": "ALWAYS runs, error or not: the cleanup crew that closes files and turns off the lights even when the party ends in a fire.",
  "raise": "Pulls the alarm on purpose: raises an error when you detect something invalid, stopping the flow until an except takes the case.",
  "Exception": "The parent of almost every error. Inheriting from it makes your own errors (class MyError(Exception)); catching it catches almost everything — convenient, but it hides surprises.",
  "ValueError": "The type is fine, but the content makes no sense: float('abc') blows up like this. The classic warning about malformed input.",
  "KeyError": "You asked for a drawer the cabinet doesn't have: a missing key in the dict. Antidotes: d.get(key, default) or check first with in.",
  "TypeError": "The operation doesn't match the ingredient: adding text to a number, for example. Python refuses the recipe before it ruins the dish.",
  "RuntimeError": "A generic runtime error: something went wrong while running and no specific category fits better. Good for flagging states that should never happen.",
  "FileNotFoundError": "The requested file is not at that path: wrong name, wrong folder, or a file not created yet. Handle it with except and give a friendly message.",
  "JSONDecodeError": "The text is not valid JSON: a stray comma, wrong quotes, a block cut in half. The error that separates random text from real JSON.",
  "json.JSONDecodeError": "The text is not valid JSON: a stray comma, wrong quotes, a block cut in half. The error that separates random text from real JSON.",
  "RateLimitError": "The provider asked you to slow down: too many calls in too little time (HTTP 429). The right fix is to wait and try again — ideally with backoff.",

  // ---------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------
  "with": "Opens a resource with guaranteed closing: leave the block and Python closes the file for you, even if an error happens midway. A spring-loaded door that never stays open.",
  "open": "Opens a file for reading or writing. Use it with with (closes by itself) and encoding='utf-8' (reads accents correctly): with open(path) as f.",

  // ---------------------------------------------------------------
  // JSON
  // ---------------------------------------------------------------
  "json": "The module that translates between JSON text and Python objects: loads/dumps for strings, load/dump for files. The sworn interpreter between APIs and your code.",
  "JSON": "A text format for exchanging structured data: objects, lists, numbers and text any language understands. The universal language of APIs.",
  "json.loads": "Turns a JSON STRING into Python objects (dict, list...) — the s stands for string. Malformed text? It raises JSONDecodeError.",
  "loads": "Turns a JSON STRING into Python objects (dict, list...) — the s stands for string. Malformed text? It raises JSONDecodeError.",
  "json.load": "Reads JSON straight from an open FILE and returns Python objects. No s at the end: this one is for files, loads is for strings.",
  "json.dumps": "The way back: turns Python objects into a JSON STRING. With ensure_ascii=False, accented characters stay readable instead of becoming codes.",
  "json.dump": "Writes Python objects as JSON straight into an open FILE. With indent=2, it comes out nicely formatted for human eyes.",
  "ensure_ascii=False": "A json.dumps option that keeps accents and special characters readable in the result, instead of swapping them for numeric codes.",

  // ---------------------------------------------------------------
  // Advanced text: regex
  // ---------------------------------------------------------------
  "re": "The regular expressions module: search patterns that find, validate and extract pieces of text — a magnet for formats that only attracts what matches.",
  "regex": "The regular expressions module: search patterns that find, validate and extract pieces of text — a magnet for formats that only attracts what matches.",
  "re.search": "Looks for the pattern anywhere in the text and returns a Match with the FIRST occurrence — or None if nothing matches. Always check for None before using it.",
  "re.findall": "Sweeps the whole text and returns a list with ALL occurrences of the pattern: the rake that gathers everything that matches.",
  "re.DOTALL": "A re flag that makes the dot in the pattern ALSO match line breaks, letting .* cross a multi-line block. Without it, the dot stops at the first line break and multi-line JSON never matches.",
  "DOTALL": "A re flag that makes the dot in the pattern ALSO match line breaks, letting .* cross a multi-line block. Without it, the dot stops at the first line break and multi-line JSON never matches.",
  "Match": "The receipt proving the pattern matched: it stores what was found and where. Use .group() for the whole match and .group(1) for the first group in parentheses.",
  ".group(1)": "Extracts only what matched the FIRST group in parentheses of the pattern: you cut out the slice you care about, not the whole match.",

  // ---------------------------------------------------------------
  // Async
  // ---------------------------------------------------------------
  "async": "Marks the function as asynchronous: it can pause at waiting points (await) and free the program to get other tasks done while it waits.",
  "await": "A waiting point in an async function: pauses HERE until the answer arrives, without freezing everything else — the waiter drops the order at the kitchen and serves other tables.",
  "asyncio": "The standard concurrency library: schedules and runs async functions, letting dozens of network waits move along in parallel on a single thread.",
  "asyncio.gather": "Fires several async tasks AT ONCE and waits for all of them: the total time becomes the slowest one, not the sum. The classic speed-up for API calls.",
  "gather": "Fires several async tasks AT ONCE and waits for all of them: the total time becomes the slowest one, not the sum. The classic speed-up for API calls.",

  // ---------------------------------------------------------------
  // Data: numpy and pandas
  // ---------------------------------------------------------------
  "numpy": "The vectors-and-matrices library: works on thousands of numbers at once, with C under the hood. The math foundation of embeddings and data science.",
  "array": "A NumPy vector: a compact block of same-type numbers that accepts bulk operations. The muscular list of math.",
  "np.array": "Turns a list into a NumPy vector: a compact block of numbers that accepts bulk operations — add, multiply, compare everything at once, no for loop.",
  "np.dot": "Dot product: multiplies two vectors position by position and adds it all up. The alignment meter between vectors — the heart of embedding similarity.",
  "np.argsort": "Returns the INDICES that would sort the vector in ASCENDING order (smallest to largest), not the values. To find the winners (highest scores), sort the negated values: np.argsort(-scores) and take the first ones.",
  "argsort": "Returns the INDICES that would sort the vector in ASCENDING order (smallest to largest), not the values. To find the winners (highest scores), sort the negated values: np.argsort(-scores) and take the first ones.",
  "np.linalg.norm": "Measures the length (norm) of a vector: the ruler of vectors. Dividing a vector by its own norm normalizes it to length 1.",
  "shape": "The array's dimensions tag: (3, 5) means 3 rows and 5 columns. Checking the shape is first aid for any matrix bug.",
  "pandas": "The tables library: loads, filters, groups and joins data like a programmable spreadsheet. The Swiss army knife of cost and usage reports.",
  "pd.DataFrame": "Builds the pandas table: pd.DataFrame(records) turns a list of dicts into a spreadsheet with named rows and columns, ready for analysis.",
  "DataFrame": "The pandas table: named rows and columns, like a programmable spreadsheet. Every column accepts bulk operations (mean, sum, filter).",
  "merge": "Joins two tables on a shared column, like matching customers and purchases by customer id. The how= argument decides the fate of rows that exist on only one side.",
  "groupby": "Groups rows by the value of a column and summarizes each group (sum, mean...): the pandas pivot table in one line of code.",
  "fillna": "Patches the holes (NaN) in the table with a default value: fillna(0.0) swaps missing for zero before adding, avoiding contaminated math.",
  "isna": "The hole detector: marks True where a value is missing (NaN). With .sum(), it counts how much data is missing before you trust an average.",
  "NaN": "Not a Number: the official hole in a table, marking a missing value. It contaminates math (anything plus NaN is NaN) and is not even equal to itself.",
  "nan": "Not a Number: the official hole in a table, marking a missing value. It contaminates math (anything plus NaN is NaN) and is not even equal to itself.",
  "cosseno": "Cosine similarity: measures the angle between two vectors, ignoring their length. Close to 1, they point the same way — texts talking about the same thing.",

  // ---------------------------------------------------------------
  // HTTP and APIs
  // ---------------------------------------------------------------
  "API": "A system's service counter: you place an order in an agreed format and get the answer back, without needing to know how the kitchen works.",
  "HTTP": "The web's request-and-response protocol: the client asks (GET, POST...), the server answers with a status and a body. Every REST API speaks it.",
  "endpoint": "The address of one specific service inside the API, like /products or /models: each counter handles one kind of order.",
  "requests": "The Python library for speaking HTTP: requests.get fetches, requests.post sends. API calls in one readable line.",
  "requests.get": "An HTTP GET request: fetches data from a URL, like looking at a shop window. Returns a Response with status_code and .json() to read the body.",
  "requests.post": "An HTTP POST request: SENDS data to the server (json=data), like handing a filled-in form over the counter.",
  "Response": "The requests reply package: carries status_code, headers and the body (via .text or .json()). Everything the server sent, wrapped in one object.",
  "resp.json()": "Converts the response body from JSON text into Python objects in one call. If the server sent something else, it blows up — check the status first.",
  ".json()": "Converts the response body from JSON text into Python objects in one call. If the server sent something else, it blows up — check the status first.",
  "status_code": "The numeric code of the HTTP response: 200 worked, 404 doesn't exist, 429 slow down, 500 broke on their side. The traffic light you MUST check before using the body.",
  "404": "HTTP status for not found: the server exists, but the requested resource doesn't. Check the id or the URL path.",
  "429": "HTTP status for too many requests (rate limit): the server asks for a break. Respect Retry-After and try later — insisting right away only makes it worse.",
  "500": "HTTP status for an internal server error: not your fault. It is usually temporary — worth retrying with backoff.",
  "Retry-After": "A header that comes with a 429 saying HOW MANY SECONDS to wait before retrying. The server's official timer: use it instead of guessing the pause.",
  "timeout": "The maximum time to wait for the answer: when it runs out, give up and raise an error. Without a timeout, the program can hang forever on a silent server.",
  "retry": "Trying again after a temporary failure (429, 500, network): the polite second chance. Always with a cap on attempts, so it doesn't turn into endless stubbornness.",
  "backoff": "A growing pause between attempts: 1s, 2s, 4s, 8s (base * 2 ** attempt). Gives the server room to breathe instead of hammering it again a second later.",
  "params": "A dictionary of query parameters that requests glues onto the URL (?page=2&limit=10): the filters of your request, without building the string by hand.",
  "raise_for_status()": "Turns an error status (4xx/5xx) into a Python exception right away: instead of carrying on with a broken response, the program complains early and loudly.",
  "cursor": "The bookmark of pagination: each response carries the cursor for the next page, and you send it back to continue exactly where you stopped.",

  // ---------------------------------------------------------------
  // AI: models, prompts and RAG
  // ---------------------------------------------------------------
  "token": "The unit the model reads and bills for: pieces of words (about 4 characters on average). Counting tokens is counting cost and context limit.",
  "prompt": "The instruction handed to the model: context, question and the format you want. A clear request gets an obedient answer; a vague one gets an overly creative answer.",
  "LLM": "Large Language Model: a model trained on mountains of text to predict the next word — and, with that, to chat, summarize, extract and write code.",
  "embedding": "The translation of a text into a vector of numbers that captures its meaning: similar sentences become neighboring vectors. The semantic GPS of search.",
  "embed": "The function that produces the embedding: text goes in, the numeric vector of meaning comes out, ready to compare with other vectors.",
  "chunk": "A controlled-size slice of a document: long texts are chopped into chunks to fit the context and sharpen the search. Overlap avoids cutting ideas in half.",
  "RAG": "Retrieval-Augmented Generation: before answering, the system SEARCHES your documents for passages and hands them to the model as context. The authorized cheat sheet for the exam.",
  "temperatura": "The model's boldness knob: near 0, predictable and repeatable answers; high, creative and risky ones. To extract data, keep it low.",
  "temperature": "The model's boldness knob: near 0, predictable and repeatable answers; high, creative and risky ones. To extract data, keep it low.",
  "max_tokens": "The token ceiling for the ANSWER: the model stops when it hits it, even mid-sentence (finish_reason becomes length). Controls cost and prevents endless answers.",
  "messages": "The list of conversation messages sent to the model, each with role and content. The model has no memory: you resend the whole history every time.",
  "role": "Who is speaking in each message: system (house rules), user (who asks) or assistant (the model). It is how the model knows whom to obey.",
  "content": "The text of the message itself — what was said. The inseparable partner of role in the chat format of LLM APIs.",
  "system": "The backstage message with the model's rules: tone, role, limits. The user doesn't see it, but it outranks their request.",
  "user": "The role of whoever asks: the human's message. It is the request the model tries to fulfill, within the system's rules.",
  "assistant": "The model's role: the answers it already gave. Resending them in the history is what gives the conversation memory.",
  "tool_calls": "Instead of text, the model asks YOU to run a function with certain arguments. Your code runs it and sends the result back so the model can continue.",
  "finish_reason": "Why the model stopped: stop (done), length (hit max_tokens — truncated answer!) or tool_calls (wants to call a function). Always check it.",
  "stopwords": "Words so common they carry no meaning (the, a, of, that): background noise. Filtering them out highlights the words that really describe the text.",

  // ---------------------------------------------------------------
  // Web lab: HTML, CSS and JavaScript
  // ---------------------------------------------------------------
  "HTML": "The page's structure language: defines WHAT exists (headings, lists, buttons) with nested tags. The skeleton that CSS dresses and JS moves.",
  "html": "The page's structure language: defines WHAT exists (headings, lists, buttons) with nested tags. The skeleton that CSS dresses and JS moves.",
  "CSS": "The look-and-feel language: selectors pick elements, rules set color, size and position. The clothes on the HTML skeleton.",
  "css": "The look-and-feel language: selectors pick elements, rules set color, size and position. The clothes on the HTML skeleton.",
  "JavaScript": "The page's behavior language: reacts to clicks, changes the HTML in real time and talks to APIs. The page's nervous system.",
  "js": "The page's behavior language: reacts to clicks, changes the HTML in real time and talks to APIs. The page's nervous system.",
  "DOM": "The live page in the browser's memory: a tree of elements that JS reads and changes. Touch the DOM and the screen changes instantly.",
  "tag": "The building block of HTML: a label between angle brackets that marks a piece of content, like <p> for a paragraph and <li> for a list item.",
  "id": "A unique identifier: on a page, each element has at most one id (found with # in CSS and getElementById in JS); in an API, it is the number that locates the resource.",
  "function": "Declares a function in JavaScript: a named, reusable block of steps, like Python's def. It takes parameters and gives back with return.",
  "addEventListener": "Installs a doorbell on the element: when the event rings (click, input, submit), your function is called. The bridge between the user's action and your code.",
  "querySelector": "Finds the FIRST element that matches a CSS selector: accepts #id, .class or tag. The universal DOM locator.",
  "textContent": "The plain text inside the element: reading shows what is written; assigning replaces the content without interpreting HTML — injection-proof.",
  "createElement": "Builds a new element in memory: document.createElement(tag) makes the piece, you fill it in and fit it into the page with appendChild.",
  "dataset": "Reads the element's data- attributes: data-target becomes element.dataset.target. A pocket for keeping your own data right in the HTML.",
  "forEach": "Walks an array running a function for each item: JavaScript's automatic for, no manual counter.",
  "classList": "The element's panel of CSS class switches: add puts one on, remove takes it off, toggle flips it, contains checks it.",
  "toggle": "Flips a class: if the element has it, remove it; if not, add it. A light switch — perfect for opening menus, closing modals and switching themes.",
  "innerHTML": "Reads or replaces the element's inner HTML as text: quick for building lists, but NEVER inject text that came from the user — it is the door to XSS.",
  "value": "The current content of a form field: what is typed right now. field.value reads it; field.value = '' clears it.",
  ".value": "The current content of a form field: what is typed right now. field.value reads it; field.value = '' clears it.",
  ".checked": "Says whether the checkbox is ticked: true or false. The direct question to the checkbox: did the user agree or not?",
  "hidden": "Hidden: with visibility:hidden the element is invisible but its space stays reserved; with display:none or the hidden attribute, it disappears entirely.",
  "visibility": "The CSS visibility property: hidden hides the element WHILE KEEPING its space (a ghost in the chair); visible shows it again.",
  "display:none": "Removes the element from the layout: it disappears AND its space is freed, like taking the furniture out of the room. Compare with visibility:hidden, which leaves the empty chair behind.",
  "style": "JS's door to the element's CSS: element.style.width = pct + '%' changes the look instantly, writing straight into the style attribute.",
  "margin": "The element's OUTER space: the breathing room between it and its neighbors, like the yard around a house. It sits outside the border.",
  "padding": "The element's INNER space: the cushioning between the border and the content, like the padding inside a box. It sits inside the border.",
  "border": "The element's frame: the line between padding (inside) and margin (outside). Width, style and color: border: 1px solid #ccc.",
  "submit": "The form's send event: fires on the button click or on Enter. With e.preventDefault(), you validate before the page reloads.",
  "click": "The click event: fires when the user clicks the element. The most common addEventListener trigger on buttons.",
  "change": "Fires when the value changes AND the action ends (ticked the checkbox, left the field). To react to every keystroke, the event is input.",
  "e.preventDefault()": "Cancels the event's default behavior: the form doesn't reload the page, the link doesn't navigate. You take the wheel from there.",
  "e.target": "The exact element where the event happened: with a single listener on the parent, e.target reveals which child was clicked — the basis of event delegation.",
  "disabled": "Turns the control off: the button goes gray and deaf to clicks. Useful until the form is valid: send.disabled = !ok.",
  "<li>": "The list item tag: each <li> is a row inside a <ul> (bulleted list) or an <ol> (numbered list).",
  "<thead>": "The table header tag: groups the row of column titles, separate from the body (<tbody>). Organizes the table and lets you style the top on its own.",
  "true": "JavaScript's true, in lowercase — different from Python's True. It is what .checked returns when the box is ticked.",
  "false": "JavaScript's false, in lowercase — different from Python's False. A failed validation and an unticked box produce it.",

  // ---------------------------------------------------------------
  // English-only aliases (tokens that appear in English content)
  // ---------------------------------------------------------------
  "cosine": "Cosine similarity: measures the angle between two vectors, ignoring their length. Close to 1, they point the same way — texts talking about the same thing.",
};
