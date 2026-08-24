frappe.ui.form.on("Style", {
	refresh(frm) {
		render_matrix(frm);
		render_rest_tab(frm);
		render_dtp_header(frm);
		render_dtp_colours_sizes(frm);
		render_dtp_activity(frm);
		render_dtp_next_action(frm);

		frm.add_custom_button(__("Sync Matrix"), () => {
			frm.save().then(() => render_matrix(frm));
		});
	},

	// Table MultiSelect fires the fieldname event on add/remove, same as a normal field
	sizes(frm) {
		sync_and_render(frm);
		render_dtp_colours_sizes(frm);
	},

	colours_add(frm) {
		sync_and_render(frm);
		render_dtp_colours_sizes(frm);
	},
	colours_remove(frm) {
		sync_and_render(frm);
		render_dtp_colours_sizes(frm);
	},

	// Any field that appears in the Design & Tech Pack summary recap should
	// refresh it live, so the user always sees the current Style Overview
	// values without ever having to type them a second time.
	style_name(frm) { render_dtp_header(frm); },
	style_no(frm) { render_dtp_header(frm); },
	customer_brand(frm) { render_dtp_header(frm); },
	designer(frm) { render_dtp_header(frm); },
	merchandiser(frm) { render_dtp_header(frm); },
	department(frm) { render_dtp_header(frm); },
	status(frm) { render_dtp_header(frm); },
	current_stage(frm) { render_dtp_header(frm); render_dtp_next_action(frm); },
	tech_pack_version(frm) { render_dtp_header(frm); },
	description(frm) { render_dtp_header(frm); },
	fit(frm) { render_dtp_header(frm); },
	sleeve(frm) { render_dtp_header(frm); },
	placket(frm) { render_dtp_header(frm); },
	collar(frm) { render_dtp_header(frm); },
	gender(frm) { render_dtp_header(frm); },
	fabric_type(frm) { render_dtp_header(frm); },
	style_image(frm) { render_dtp_header(frm); },

	onload(frm) {
		render_matrix(frm);
	}
});

function sync_and_render(frm) {
	if (frm.is_new()) {
		render_matrix(frm);
		return;
	}
	frm.save().then(() => render_matrix(frm));
}

function render_matrix(frm) {
	const wrapper = frm.get_field("matrix_html").$wrapper;
	wrapper.empty();

	const colours = (frm.doc.colours || []).filter(c => (c.status || "Active") === "Active");
	const sizes = frm.doc.sizes || [];

	if (!colours.length || !sizes.length) {
		wrapper.html(`<div class="text-muted padding">${__(
			"Add at least one Colour and select Sizes above, then save, to generate the matrix."
		)}</div>`);
		return;
	}

	if (frm.is_new() || frm.is_dirty()) {
		wrapper.html(`<div class="text-muted padding">
			${__("Save the Style to build the Colour x Size matrix.")}
		</div>`);
		return;
	}

	let html = `<div class="table-responsive"><table class="table table-bordered apparel-matrix">
		<thead><tr><th>${__("Colour")}</th>`;
	sizes.forEach(s => {
		html += `<th class="text-center">${frappe.utils.escape_html(s.size)}</th>`;
	});
	html += `</tr></thead><tbody>`;

	colours.forEach(colour => {
		const colour_code = colour.colour_code || colour.colour_name;
		html += `<tr><td><strong>${frappe.utils.escape_html(colour.colour_name)}</strong>`;
		if (colour.swatch) {
			html += ` <span class="indicator-pill" style="background:${colour.swatch}">&nbsp;</span>`;
		}
		html += `</td>`;

		sizes.forEach(size_row => {
			const size_code = get_size_code(frm, size_row.size);
			const matrix_row = (frm.doc.matrix_items || []).find(
				m => m.colour_code === colour_code && m.size_code === size_code
			);

			html += `<td class="text-center apparel-matrix-cell" data-colour="${colour_code}" data-size="${size_code}">`;
			if (matrix_row && matrix_row.item) {
				html += `<a href="#" class="matrix-sku matrix-generated" data-item="${matrix_row.item}">
					${matrix_row.sku}<br><span class="indicator green">${__("Active")}</span></a>`;
			} else if (matrix_row) {
				html += `<a href="#" class="matrix-sku matrix-empty">
					${__("+ Generate")}</a>`;
			} else {
				html += `<span class="text-muted">${__("--")}</span>`;
			}
			html += `</td>`;
		});
		html += `</tr>`;
	});

	html += `</tbody></table></div>
	<style>
		.apparel-matrix th, .apparel-matrix td { vertical-align: middle; }
		.apparel-matrix .matrix-sku { display: inline-block; padding: 6px 4px; }
		.apparel-matrix .matrix-empty { color: var(--text-muted); border: 1px dashed var(--dark-border-color); border-radius: 4px; padding: 6px 10px; }
		.apparel-matrix .matrix-generated { font-weight: 600; }
	</style>`;

	wrapper.html(html);

	wrapper.find(".matrix-sku").on("click", function (e) {
		e.preventDefault();
		const $cell = $(this).closest(".apparel-matrix-cell");
		const colour_code = $cell.attr("data-colour");
		const size_code = $cell.attr("data-size");
		const item = $(this).attr("data-item");

		if (item) {
			// already generated - just redirect straight to the Item (image preview, not a link)
			frappe.set_route("Form", "Item", item);
			return;
		}

		frappe.dom.freeze(__("Generating SKU & BOM..."));
		frappe.call({
			method: "apparel_erp.product_development.doctype.style.style.generate_sku",
			args: {
				style: frm.doc.name,
				colour_code: colour_code,
				size_code: size_code
			},
			callback: function (r) {
				frappe.dom.unfreeze();
				if (r.message && r.message.item) {
					frappe.show_alert({
						message: __("SKU {0} created", [r.message.item]),
						indicator: "green"
					});
					// redirect straight into the Item form - Attach Image field
					// previews the style image inline, it is not shown as a bare link
					frappe.set_route("Form", "Item", r.message.item);
				}
			},
			error: function () {
				frappe.dom.unfreeze();
			}
		});
	});
}

function get_size_code(frm, size_link) {
	// pull from locals cache populated by the Size link field / fetched list
	const size_doc = frappe.get_doc("Size", size_link);
	if (size_doc && size_doc.size_code) return size_doc.size_code;
	return size_link;
}

function render_rest_tab(frm) {
	const wrapper = frm.get_field("rest_api_html").$wrapper;
	wrapper.empty();

	if (frm.is_new()) {
		wrapper.html(`<div class="text-muted padding">${__(
			"Save the record to get its REST API endpoint."
		)}</div>`);
		return;
	}

	const base = window.location.origin;
	const resource_url = `${base}/api/resource/Style/${encodeURIComponent(frm.doc.name)}`;
	const curl = `curl -X GET "${resource_url}" \\\n  -H "Authorization: token <api_key>:<api_secret>"`;

	const html = `
		<div class="apparel-rest-tab">
			<h5>${__("Resource URL")}</h5>
			<div class="input-group" style="max-width:640px;">
				<input type="text" class="form-control" readonly value="${resource_url}">
				<div class="input-group-append">
					<button class="btn btn-default btn-sm copy-rest-url">${__("Copy")}</button>
				</div>
			</div>
			<h5 class="margin-top">${__("Example (cURL)")}</h5>
			<pre>${frappe.utils.escape_html(curl)}</pre>
			<h5 class="margin-top">${__("Common operations")}</h5>
			<ul>
				<li><b>GET</b> ${resource_url} - ${__("fetch this Style")}</li>
				<li><b>PUT</b> ${resource_url} - ${__("update this Style")}</li>
				<li><b>DELETE</b> ${resource_url} - ${__("delete this Style")}</li>
				<li><b>POST</b> ${base}/api/resource/Style - ${__("create a new Style")}</li>
				<li><b>POST</b> ${base}/api/method/apparel_erp.product_development.doctype.style.style.generate_sku - ${__("generate a matrix SKU + BOM programmatically")}</li>
			</ul>
		</div>`;

	wrapper.html(html);
	wrapper.find(".copy-rest-url").on("click", function () {
		frappe.utils.copy_to_clipboard(resource_url);
	});
}

// ---------------------------------------------------------------------
// Design & Tech Pack tab
//
// Every value shown here already lives on the Style Overview tab (or is
// computed). None of it is re-entered - it is read straight off frm.doc
// and re-rendered whenever the source field changes (see the field
// handlers above), so the user only ever types it once.
// ---------------------------------------------------------------------

function render_dtp_header(frm) {
	const field = frm.get_field("dtp_header_html");
	if (!field) return;
	const wrapper = field.$wrapper;
	wrapper.empty();

	const d = frm.doc;
	const esc = frappe.utils.escape_html;
	const val = (v) => (v ? esc(v) : `<span class="text-muted">${__("--")}</span>`);

	const image_html = d.style_image
		? `<img src="${esc(d.style_image)}" class="apparel-dtp-thumb">`
		: `<div class="apparel-dtp-thumb apparel-dtp-thumb-empty">${__("No Image")}</div>`;

	const stage_colour = {
		"Style Overview": "gray", "Design & Tech Pack": "blue", "BOM": "blue",
		"Samples": "orange", "Costing": "orange", "Fit Approval": "orange",
		"Proto Approval": "orange", "Production": "green"
	}[d.current_stage] || "gray";

	const html = `
		<div class="apparel-dtp-header">
			<div class="apparel-dtp-header-image">${image_html}</div>
			<div class="apparel-dtp-header-grid">
				<div><label>${__("Style No")}</label><div>${val(d.style_no)}</div></div>
				<div><label>${__("Style Name")}</label><div>${val(d.style_name)}</div></div>
				<div><label>${__("Customer / Brand")}</label><div>${val(d.customer_brand)}</div></div>
				<div><label>${__("Designer")}</label><div>${val(d.designer)}</div></div>
				<div><label>${__("Merchandiser")}</label><div>${val(d.merchandiser)}</div></div>
				<div><label>${__("Department")}</label><div>${val(d.department)}</div></div>
				<div><label>${__("Current Stage")}</label><div><span class="indicator-pill ${stage_colour}">${val(d.current_stage)}</span></div></div>
				<div><label>${__("Tech Pack Version")}</label><div>${val(d.tech_pack_version)}</div></div>
				<div><label>${__("Last Updated On")}</label><div>${d.modified ? frappe.datetime.str_to_user(d.modified) : __("--")}</div></div>
				<div><label>${__("Last Updated By")}</label><div>${val(d.modified_by)}</div></div>
				<div><label>${__("Status")}</label><div><span class="indicator-pill ${d.status === "Active" ? "green" : "gray"}">${val(d.status)}</span></div></div>
			</div>
			<div class="apparel-dtp-header-desc">
				<label>${__("Description")}</label>
				<div>${val(d.description)}</div>
				<label class="margin-top">${__("Key Attributes")}</label>
				<div class="apparel-dtp-attrs">
					<div><b>${__("Fit")}</b> ${val(d.fit)}</div>
					<div><b>${__("Sleeve")}</b> ${val(d.sleeve)}</div>
					<div><b>${__("Placket")}</b> ${val(d.placket)}</div>
					<div><b>${__("Collar")}</b> ${val(d.collar)}</div>
					<div><b>${__("Gender")}</b> ${val(d.gender)}</div>
					<div><b>${__("Fabric Type")}</b> ${val(d.fabric_type)}</div>
				</div>
			</div>
		</div>
		<style>
			.apparel-dtp-header { display: flex; gap: 20px; padding: 12px; border: 1px solid var(--dark-border-color); border-radius: 8px; flex-wrap: wrap; margin-bottom: 6px; }
			.apparel-dtp-thumb { width: 90px; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid var(--dark-border-color); }
			.apparel-dtp-thumb-empty { display:flex; align-items:center; justify-content:center; color: var(--text-muted); font-size: 11px; text-align:center; }
			.apparel-dtp-header-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 18px; flex: 2; min-width: 320px; }
			.apparel-dtp-header-grid label, .apparel-dtp-header-desc label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .02em; display:block; }
			.apparel-dtp-header-desc { flex: 1.4; min-width: 240px; }
			.apparel-dtp-attrs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 4px; }
			.apparel-dtp-attrs b { font-weight: 600; margin-right: 4px; }
			.margin-top { margin-top: 8px; }
		</style>`;

	wrapper.html(html);
}

function render_dtp_colours_sizes(frm) {
	const field = frm.get_field("dtp_colours_sizes_html");
	if (!field) return;
	const wrapper = field.$wrapper;
	wrapper.empty();

	const colours = (frm.doc.colours || []).filter(c => (c.status || "Active") === "Active");
	const sizes = frm.doc.sizes || [];
	const esc = frappe.utils.escape_html;

	if (!colours.length && !sizes.length) {
		wrapper.html(`<div class="text-muted padding">${__(
			"No colours or sizes selected yet. Add them on the Colours & Sizes tab - they'll show up here automatically."
		)}</div>`);
		return;
	}

	let html = `<div class="apparel-dtp-cs">`;

	html += `<div class="apparel-dtp-cs-block"><label>${__("Colourways")}</label><div class="apparel-dtp-swatches">`;
	if (colours.length) {
		colours.forEach(c => {
			const bg = c.swatch || "#e0e0e0";
			html += `<div class="apparel-dtp-swatch">
				<div class="apparel-dtp-swatch-box" style="background:${esc(bg)}"></div>
				<div class="apparel-dtp-swatch-label">${esc(c.colour_name)}<br><span class="text-muted">${esc(c.colour_code || "")}</span></div>
			</div>`;
		});
	} else {
		html += `<span class="text-muted">${__("None yet")}</span>`;
	}
	html += `</div></div>`;

	html += `<div class="apparel-dtp-cs-block"><label>${__("Size Range")}</label><div class="apparel-dtp-sizes">`;
	if (sizes.length) {
		sizes.forEach(s => {
			html += `<span class="apparel-dtp-size-pill">${esc(s.size)}</span>`;
		});
	} else {
		html += `<span class="text-muted">${__("None yet")}</span>`;
	}
	html += `</div></div></div>
		<style>
			.apparel-dtp-cs { display: flex; gap: 32px; flex-wrap: wrap; }
			.apparel-dtp-cs label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .02em; display:block; margin-bottom: 6px; }
			.apparel-dtp-swatches, .apparel-dtp-sizes { display: flex; gap: 10px; flex-wrap: wrap; }
			.apparel-dtp-swatch { text-align: center; font-size: 12px; }
			.apparel-dtp-swatch-box { width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--dark-border-color); margin: 0 auto 4px; }
			.apparel-dtp-size-pill { border: 1px solid var(--dark-border-color); border-radius: 6px; padding: 6px 14px; font-weight: 600; }
		</style>`;

	wrapper.html(html);
}

function render_dtp_activity(frm) {
	const field = frm.get_field("dtp_activity_html");
	if (!field) return;
	const wrapper = field.$wrapper;
	wrapper.empty();

	if (frm.is_new()) {
		wrapper.html(`<div class="text-muted padding">${__("Save the Style to start its activity log.")}</div>`);
		return;
	}

	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Version",
			filters: { ref_doctype: "Style", docname: frm.doc.name },
			fields: ["owner", "creation"],
			order_by: "creation desc",
			limit_page_length: 8
		},
		callback: function (r) {
			const esc = frappe.utils.escape_html;
			let rows = r.message || [];
			let html = `<div class="apparel-dtp-activity">`;
			if (!rows.length) {
				html += `<div class="apparel-dtp-activity-row">
					<div class="apparel-dtp-activity-when">${frappe.datetime.str_to_user(frm.doc.creation)}</div>
					<div><b>${esc(frm.doc.owner)}</b><div class="text-muted">${__("Created Style")}</div></div>
				</div>`;
			} else {
				rows.forEach(row => {
					html += `<div class="apparel-dtp-activity-row">
						<div class="apparel-dtp-activity-when">${frappe.datetime.str_to_user(row.creation)}</div>
						<div><b>${esc(row.owner)}</b><div class="text-muted">${__("Updated the record")}</div></div>
					</div>`;
				});
			}
			html += `</div>
				<style>
					.apparel-dtp-activity-row { display:flex; gap: 14px; padding: 6px 0; border-bottom: 1px solid var(--dark-border-color); }
					.apparel-dtp-activity-row:last-child { border-bottom: none; }
					.apparel-dtp-activity-when { min-width: 150px; color: var(--text-muted); font-size: 12px; }
				</style>`;
			wrapper.html(html);
		}
	});
}

function render_dtp_next_action(frm) {
	const field = frm.get_field("dtp_next_action_html");
	if (!field) return;
	const wrapper = field.$wrapper;
	wrapper.empty();

	const next_stage_map = {
		"Style Overview": "Design & Tech Pack",
		"Design & Tech Pack": "Samples",
		"BOM": "Samples",
		"Samples": "Costing",
		"Costing": "Fit Approval",
		"Fit Approval": "Proto Approval",
		"Proto Approval": "Production"
	};
	const next_stage = next_stage_map[frm.doc.current_stage];

	if (!next_stage) {
		wrapper.html(`<div class="text-muted padding">${__("This style has reached its final stage.")}</div>`);
		return;
	}

	const button_label = next_stage === "Samples" ? __("Send for Sampling") : __("Move to {0}", [__(next_stage)]);
	const btn_id = "apparel-dtp-next-action-btn";

	wrapper.html(`<div class="padding">
		<button class="btn btn-primary btn-sm" id="${btn_id}">${button_label}</button>
	</div>`);

	wrapper.find(`#${btn_id}`).on("click", function () {
		if (frm.is_dirty()) {
			frappe.msgprint(__("Please save the Style first."));
			return;
		}
		frappe.call({
			method: "apparel_erp.product_development.doctype.style.style.advance_stage",
			args: { style: frm.doc.name, next_stage: next_stage, assign_to: frm.doc.assign_to },
			freeze: true,
			freeze_message: __("Updating stage..."),
			callback: function () {
				frappe.show_alert({ message: __("Moved to {0}", [__(next_stage)]), indicator: "green" });
				frm.reload_doc();
			}
		});
	});
}
