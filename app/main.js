const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require('crypto');

// You can use print statements as follows for debugging, they'll be visible when running tests.
// console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const command = process.argv[2];

switch (command) {
  case "init":
    createGitDirectory();
    break;
  case 'cat-file':{
    const flag = process.argv[3];
    const SHA = process.argv[4];
    if(flag === '-p')
        catFile(SHA);
    else
        throw new Error(`Unknown flag ${flag}`);
    break;
  }
  case 'hash-object':{
    const flag = process.argv[3];
    const filePath = process.argv[4];
    if(flag === '-w')
        writeObject(filePath);
    else
        throw new Error(`Unknown flag ${flag}`);
    break;
  }
  case 'ls-tree':{
    const flag = process.argv[3];
    const treeSHA = process.argv[4];
    if(flag === '--name-only')
        createTree(treeSHA);
    else
        throw new Error(`Unknown flag ${flag}`);
    break;
  } 
  default:
    throw new Error(`Unknown command ${command}`);
}

function createGitDirectory() {
  fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });

  fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
  console.log("Initialized git directory");
}

function catFile(blobSHA) {
    const blobPath = path.join(process.cwd(), ".git", "objects", blobSHA.slice(0, 2), blobSHA.slice(2));
    const blobContent = fs.readFileSync(blobPath);
    const compressedData = Buffer.from(blobContent, 'base64');

    zlib.unzip(compressedData, (err, buffer)=>{
        if(err){
            console.error('Error compressing data : ', err);
        } else{
            const unCompressedData = buffer.toString('utf-8')
            const content = unCompressedData.split('\x00')[1];
            process.stdout.write(content);
        }
    })
  }

function writeObject(filePath){
  const { size } = fs.statSync(filePath);
  const data = fs.readFileSync(filePath);
  const content = `blob ${size}\0${data.toString()}`;
  const blobSha = crypto.createHash("sha1").update(content).digest("hex");
  const objDir = blobSha.substring(0, 2);
  const objFile = blobSha.substring(2);
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects", objDir), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(process.cwd(), ".git", "objects", objDir, objFile),
    zlib.deflateSync(content),
  );
  process.stdout.write(`${blobSha}\n`);
}

function createTree(treeSHA){
    const directory = treeSHA.slice(0, 2);
    const fileName = treeSHA.slice(2);
    const filePath = path.join(process.cwd(), ".git", "objects", directory, fileName);

    // Check if the object file exists
    if (!fs.existsSync(filePath)) {
        console.error(`Error: Object file ${filePath} does not exist.`);
        process.exit(1);  // Exit with error code
    }

    // Read and inflate the tree object
    let inflatedContent = zlib.inflateSync(fs.readFileSync(filePath));

    let index = inflatedContent.indexOf(0x00) + 1;
    while (index < inflatedContent.length) {
        // Parse the mode (ends at the first space)
        let spaceIndex = inflatedContent.indexOf(0x20, index);
        let mode = inflatedContent.slice(index, spaceIndex).toString();

        // Parse the name (ends at the null byte)
        let nullIndex = inflatedContent.indexOf(0x00, spaceIndex + 1);
        let name = inflatedContent.slice(spaceIndex + 1, nullIndex).toString();

        // Parse the SHA-1 hash (next 20 bytes)
        let shaStart = nullIndex + 1;
        let shaEnd = shaStart + 20;
        let sha = inflatedContent.slice(shaStart, shaEnd).toString('hex');

        // Output the file name (you can also output mode and SHA-1 if needed)
        process.stdout.write(`${name}\n`);

        // Move the index forward to the next entry
        index = shaEnd;
    }
}
