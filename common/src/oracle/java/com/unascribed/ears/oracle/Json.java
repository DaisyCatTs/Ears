package com.unascribed.ears.oracle;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * A deliberately tiny, deterministic JSON writer. Fixtures are checked into git and diffed against
 * the TypeScript implementation, so formatting stability matters more than features here.
 * <p>
 * Values may be {@link Map} (written in iteration order — use a LinkedHashMap or TreeMap),
 * {@link List}, {@link String}, {@link Number}, {@link Boolean}, or null.
 */
public final class Json {

	private Json() {}

	public static String write(Object value) {
		StringBuilder sb = new StringBuilder();
		write(value, sb, 0);
		sb.append('\n');
		return sb.toString();
	}

	private static void write(Object value, StringBuilder sb, int depth) {
		if (value == null) {
			sb.append("null");
		} else if (value instanceof Map) {
			Map<?, ?> map = (Map<?, ?>)value;
			if (map.isEmpty()) {
				sb.append("{}");
				return;
			}
			sb.append("{\n");
			boolean first = true;
			for (Map.Entry<?, ?> en : map.entrySet()) {
				if (!first) sb.append(",\n");
				first = false;
				indent(sb, depth+1);
				writeString(String.valueOf(en.getKey()), sb);
				sb.append(": ");
				write(en.getValue(), sb, depth+1);
			}
			sb.append('\n');
			indent(sb, depth);
			sb.append('}');
		} else if (value instanceof List) {
			List<?> list = (List<?>)value;
			if (list.isEmpty()) {
				sb.append("[]");
				return;
			}
			sb.append("[\n");
			boolean first = true;
			for (Object o : list) {
				if (!first) sb.append(",\n");
				first = false;
				indent(sb, depth+1);
				write(o, sb, depth+1);
			}
			sb.append('\n');
			indent(sb, depth);
			sb.append(']');
		} else if (value instanceof String) {
			writeString((String)value, sb);
		} else if (value instanceof Boolean) {
			sb.append(value.toString());
		} else if (value instanceof Float || value instanceof Double) {
			sb.append(number(((Number)value).doubleValue()));
		} else if (value instanceof Number) {
			sb.append(value.toString());
		} else {
			throw new IllegalArgumentException("Don't know how to write a "+value.getClass().getName());
		}
	}

	/**
	 * Floats are written with a fixed six decimal places so that a rounding difference shows up as
	 * a diff rather than hiding behind a shorter repr. -0 is normalized to 0.
	 */
	private static String number(double d) {
		if (d == 0) d = 0;
		if (Double.isNaN(d) || Double.isInfinite(d)) {
			throw new IllegalArgumentException("Refusing to write "+d+" — fixtures must be finite");
		}
		return String.format(Locale.ROOT, "%.6f", d);
	}

	private static void indent(StringBuilder sb, int depth) {
		for (int i = 0; i < depth; i++) sb.append('\t');
	}

	private static void writeString(String s, StringBuilder sb) {
		sb.append('"');
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			switch (c) {
				case '"': sb.append("\\\""); break;
				case '\\': sb.append("\\\\"); break;
				case '\n': sb.append("\\n"); break;
				case '\r': sb.append("\\r"); break;
				case '\t': sb.append("\\t"); break;
				default:
					if (c < 0x20 || c > 0x7E) {
						sb.append(String.format(Locale.ROOT, "\\u%04x", (int)c));
					} else {
						sb.append(c);
					}
			}
		}
		sb.append('"');
	}

}
