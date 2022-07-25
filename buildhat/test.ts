import { SerialPort } from 'serialport';

const main = async () => {
  const serial = new SerialPort({ path: '/dev/serial0', baudRate: 115200 });

  const stdin = process.openStdin();

	stdin.addListener("data", (d) => {
    // note:  d is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that
    // with toString() and then trim()
    const command = d.toString();
    console.log("you entered: [" + command.trim() + "]");

    serial.write(command)
  });

}

main();
