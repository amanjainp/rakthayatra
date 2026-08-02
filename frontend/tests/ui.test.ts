import { Button } from '../src/components/ui/Button';
import { Badge } from '../src/components/ui/Badge';
import { Alert } from '../src/components/ui/Alert';
import { Card } from '../src/components/ui/Card';
import { Input } from '../src/components/ui/Input';
import { Table } from '../src/components/ui/Table';

describe('UI Shared Components Integrity Tests', () => {
  it('should export atomic elements as functional components', () => {
    expect(typeof Button).toBe('function');
    expect(typeof Badge).toBe('function');
    expect(typeof Alert).toBe('function');
    expect(typeof Card).toBe('function');
    expect(typeof Input).toBe('object');
    expect(typeof Table).toBe('function');
  });
});
