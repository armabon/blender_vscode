
def handle_fatal_error(message):
    print()
    print("#"*80)
    for line in message.splitlines():
        print(">  ", line)
    print("#"*80)
    print()
    sys.exit(1)