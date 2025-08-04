#!/usr/bin/env node

if (process.argv[2] === '__complete') {
  console.log('hello\tSay hello');
  console.log('world\tSay world');
  process.exit(0);
} else {
  const command = process.argv[2];
  if (command === 'hello') {
    console.log('Hello!');
  } else if (command === 'world') {
    console.log('World!');
  } else {
    console.log('Usage: tiny-cli [hello|world]');
  }
}
