const MessageKind = {
  0: 'Start',
  1: 'Work',
  2: 'Stop',
  Start: 0,
  Work: 1,
  Stop: 2,
} as const;

type MessageKind = typeof MessageKind[keyof typeof MessageKind & string];
