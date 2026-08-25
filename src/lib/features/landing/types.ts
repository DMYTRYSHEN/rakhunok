export type NavLink = {
	label: string;
	href: `#${string}`;
};

export type ContentCard = {
	label?: string;
	title: string;
	description: string;
};

export type PricingPlan = {
	name: string;
	price: string;
	description: string;
	features: string[];
	cta: string;
	note: string;
	popular?: boolean;
};

export type FaqItem = {
	question: string;
	answer: string;
};
