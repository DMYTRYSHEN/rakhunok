export type EnvironmentKey = 'prod' | 'staging' | 'local';

export type ServiceCategory =
	| 'all'
	| 'core'
	| 'merchant'
	| 'payments'
	| 'automation'
	| 'logistics'
	| 'next_step';

export interface ServiceItem {
	id: string;
	index: string;
	title: string;
	tagline: string;
	subtitle: string;
	category: string;
	categoryId: ServiceCategory;
	badge: string;
	status: 'live' | 'ready' | 'beta' | 'in_development';
	isNextStep?: boolean;
	essence: string;
	keyMetric: string;
	metricLabel: string;
	description: string;
	features: string[];
	tags: string[];
	paths: {
		prod: string;
		staging: string;
		local: string;
	};
	icon: string;
	accentColor: string;
	roleInFlow: string;
}

export interface EcosystemCategoryTab {
	id: ServiceCategory;
	label: string;
}
