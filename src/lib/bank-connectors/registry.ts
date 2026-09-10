/**
 * BankConnectorRegistry
 * Registry and factory for all bank drivers
 */

import type { BankConnectorDriver } from './driver.ts';
import { PrivatBankDriver } from './drivers/privatbank.ts';
import { ABankDriver } from './drivers/a-bank.ts';
import { MonobankDriver } from './drivers/monobank.ts';
import type { BankCapabilities, BankId } from './types.ts';

export class BankConnectorRegistry {
	private readonly drivers = new Map<string, BankConnectorDriver>();

	constructor() {
		// Register default supported banks
		this.register(new PrivatBankDriver());
		this.register(new ABankDriver());
		this.register(new MonobankDriver());
	}

	register(driver: BankConnectorDriver): void {
		this.drivers.set(driver.id.toLowerCase(), driver);
	}

	get(bankId: BankId): BankConnectorDriver | undefined {
		return this.drivers.get(bankId.toLowerCase());
	}

	has(bankId: BankId): boolean {
		return this.drivers.has(bankId.toLowerCase());
	}

	list(): BankConnectorDriver[] {
		return Array.from(this.drivers.values());
	}

	getCapabilities(bankId: BankId): BankCapabilities | undefined {
		return this.get(bankId)?.capabilities;
	}
}

// Global singleton instance
export const defaultBankRegistry = new BankConnectorRegistry();
