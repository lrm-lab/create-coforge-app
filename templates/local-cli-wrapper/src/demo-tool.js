const text = process.argv[2].trim();
console.log(JSON.stringify({ words: text ? text.split(/\s+/).length : 0 }));
