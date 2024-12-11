class Accomodation {
  constructor(name, url, text, cost = 0, paymentLink = "") {
    this.name = name;
    this.url = url;
    this.text = text;
    this.cost = cost;
    this.paymentLink = paymentLink ? `${paymentLink}/${cost}/${name.replace(/ /g, '-')}` : '';
  }
}

export const all_text = `
If you've received this invite, it means that we consider you a member of our really rad inner circle. 
Our problem is that our circle spreads across the whole world. 
<br><br>
We decided to make our wedding a multi-day event, not only so that we'd have enough time to connect with everyone, 
but also for you to get to know some other rad humans that we've specially curated. 
<br><br>
We'll be handling the catering and activities from Tuesday evening to Thursday morning, so we'd love for you to 
stay in the area so we can all do cool things together like braaing, hiking, mountain biking, and even 
meeting the resident sheep (many sheep, not just one sheep).
`;

export const general_text = `
Here is a spot near the venue that we suggest for you, but feel free to find anywhere you'd like to call home for a couple nights. You're also more than welcome to stay only the one night or even just come through for the event 🙂
`;

export const faraway = new Accomodation(
  "Faraway Estate",
  "https://www.lekkeslaap.co.za/accommodation/faraway-estate",
  `We would love to have you stay with us at Faraway Estate itself. We kindly ask for you to contribute R3 000 per room, which helps us cover your accommodation`,
  3000,
  "https://just.wigwag.me/rainy-wedding"
);

export const reitspruit = new Accomodation(
  "Reitspruit",
  "https://www.lekkeslaap.co.za/accommodation/rietspruit-country-cottage/book",
  general_text
);

export const container = new Accomodation(
  "Container",
  "https://www.airbnb.co.za/rooms/666980800539905078",
  general_text
);

export const pink = new Accomodation(
  "Pink",
  "https://www.airbnb.co.za/rooms/7322107",
  general_text
);

export const bergendal = new Accomodation(
  "Bergendal",
  "https://book.nightsbridge.com/19785",
  general_text
);

export const devilliers = new Accomodation(
  "Devilliers",
  "https://book.nightsbridge.com/19785",
  general_text,
  1600
);

export function get_accom_data(accom) {
  const accomLower = accom.toLowerCase();

  if (accomLower.includes("faraway")) {
    return faraway;
  }
  if (accomLower.includes("rietspruit")) {
    return reitspruit;
  }
  if (accomLower.includes("container")) {
    return container;
  }
  if (accomLower.includes("pink")) {
    return pink;
  }
  if (accomLower.includes("bergendal")) {
    return bergendal;
  }
  if (accomLower.includes("de villiers")) {
    return devilliers;
  }

  // Default case
  return null;
}
