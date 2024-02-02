#!/usr/bin/env python3
"""
A simple hex dump example with colorized output.
Per request, the output is structured with ASCII aligned
with corresponding data bytes, rather than the canonical
style typically used in hex dumps (e.g. hexdump -C).
The colorization is performed in a second pass, rather than
during a single pass, just to separate the requested example
from the "bells and whistles" version.
Dependencies:
    * Python >= 3.6
    * rich - https://github.com/willmcgugan/rich
             (pip install rich)
Usage:
    ./rich_hexdump.py <filename>
SPDX-License-Identifier: BSD-3-Clause
Author: Jon Szymaniak <jon.szymaniak.foss@gmail.com>
"""

import sys
from os.path import basename
from os import linesep

from rich.console import Console
from rich.text import Text

THIS_SCRIPT = basename(__file__)


def split_data(data: bytes, chunk_size: int) -> tuple:
    """
    Split data into 32-byte sized chunks.
    Return a tuple in which each element is a "chunk" of 32-bytes (or less on
    the final chunk).
    """
    return (data[i : i + chunk_size] for i in range(0, len(data), chunk_size))


def create_hexdump(data: bytes, placeholder=".") -> str:
    # The hex dump string we'll return
    hexdump = ""

    # Iterate over data in 32-byte chunks.
    for chunk in split_data(data, 32):
        # Create the pair of lines with the hex and ASCII representations
        hex_line = ""
        ascii_line = ""

        # Iterate over each byte value in the chunk
        for value in chunk:
            hex_line += "{:02x} ".format(value)

            if 0x20 <= value <= 0x7F:
                # Printable character
                ascii_line += " " + chr(value) + " "
            else:
                # Insert the placeholder for non-printables
                ascii_line += " " + placeholder + " "

        # Report each chunk in its hexadecimal representation, followed by
        # the corresponding ASCII representation, with another new line before
        # the results for the next chunk.
        hexdump += hex_line + linesep
        hexdump += ascii_line + linesep
        hexdump += linesep

    return hexdump


_COLORS = (
    "#d06040",
    "#20d020",
    "#2080f0",
    "#d080d0",
)


def append_colorized_line(text, line: str, inc: int):
    c = 0

    # Iterate over the line ``inc`` characters at a time.
    for i in range(0, len(line), inc):
        text.append(line[i : i + inc], style=_COLORS[c])

        # Advance to next color
        c += 1
        if c >= len(_COLORS):
            c = 0

    text.append(linesep)


def print_colored_hexdump(hexdump: str):
    console = Console()
    text = Text()

    # Iterate over hexdump, 3 lines at a time.
    #   [0]: Hex representation
    #   [1]: ASCII representation
    #   [2]: Newline
    lines = hexdump.splitlines()
    for i in range(0, len(lines), 3):
        append_colorized_line(text, lines[i], 3)
        append_colorized_line(text, lines[i + 1], 3)
        text.append(linesep)

    console.print(text)


if __name__ == "__main__":
    if len(sys.argv) != 2 or "-h" in sys.argv or "--help" in sys.argv:
        print("Usage: " + THIS_SCRIPT + " <filename>", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1], "rb") as infile:
        data = infile.read()

        hexdump = create_hexdump(data)
        # print(hexdump)

        print_colored_hexdump(hexdump)
